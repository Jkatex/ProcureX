import { createHash, randomBytes } from 'node:crypto';
import { AccountType, AdminActionType, AuditSeverity, CommunicationStatus, ComplianceCaseStatus, MemberStatus, type Prisma } from '@prisma/client';
import { withDbContext } from '../../db/context.js';
import { ModuleRepository, type AdminActionRow, type AdminUserRow, type AuditEventRow, type ComplianceCaseRow, type ComplianceRuleRow, type DataStoreEntryRow, type DataStoreEntryVersionRow } from './repository.js';
import {
  moduleDefinition,
  adminAppDefinitions,
  type AdminAppsDto,
  type AdminActionDto,
  type AdminActionInput,
  type AdminNoteInput,
  type AdminUserDto,
  type AdminUserActionInput,
  type AdminUserInviteInput,
  type AnalyticsDto,
  type AnalyticsQuery,
  type AuditEventDto,
  type AuditListQuery,
  type CaseListQuery,
  type CaseUpdateInput,
  type ComplianceCaseDto,
  type ComplianceRuleDto,
  type DataStoreDeleteInput,
  type DataStoreEntryCreateInput,
  type DataStoreEntryDto,
  type DataStoreEntryQuery,
  type DataStoreEntryUpdateInput,
  type DataStoreEntryVersionDto,
  type DataStoreNamespaceDto,
  type DataStoreNamespaceQuery,
  type DashboardDto,
  type ModuleStatus,
  type PageDto,
  type RuleCreateInput,
  type RuleListQuery,
  type RuleUpdateInput,
  type SearchQuery,
  type SearchResultDto,
  type AdminProfilePreferencesInput,
  type UserListQuery
} from './types.js';
import { requestError } from '../shared/apiErrors.js';
import { rebuildComplianceIndex, searchComplianceIndex, type SearchIndexDocument } from './searchIndex.js';

type AdminSession = Awaited<ReturnType<ModuleRepository['findActiveSession']>>;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function randomToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function workflowDto<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value instanceof Date) return [key, value.toISOString()];
      if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
        return [key, (value as { toNumber: () => number }).toNumber()];
      }
      return [key, value];
    })
  );
}

function page<T>(items: T[], query: { page: number; pageSize: number }, total = items.length): PageDto<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async apps(token: string | undefined): Promise<AdminAppsDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async () => {
      const generatedAt = new Date().toISOString();
      return {
        items: adminAppDefinitions.map((item) => ({ ...item, generatedAt })),
        generatedAt
      };
    });
  }

  async dashboard(token: string | undefined): Promise<DashboardDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.dashboard(tx);
      const weeklyComplianceActions = weeklyBuckets(result.weeklyActions ?? []);
      return {
        counts: result.counts,
        metrics: [
          { label: 'Active Tenders', value: result.counts.activeTenders, detail: 'Draft, review, published, open, and evaluation tenders' },
          { label: 'Pending Compliance Reviews', value: result.counts.pendingReviews, detail: 'Open compliance cases plus pending verifications' },
          { label: 'Flagged Issues', value: result.counts.flaggedIssues, detail: 'Critical compliance cases and risk signals' },
          { label: 'Compliance Rate', value: result.counts.complianceRate, detail: 'Resolved or false-positive cases' },
          { label: 'Evaluation Drafts', value: result.counts.evaluationDrafts, detail: 'Evaluation workspaces still in progress' },
          { label: 'Audit Events Today', value: result.counts.auditEventsToday, detail: 'Events recorded since midnight' }
        ],
        riskSummary: Object.fromEntries(result.riskGroups.map((group) => [group.riskLevel, group._count._all])),
        adminActionQueue: result.openComplianceItems.map((item) => ({
          id: item.id,
          title: item.title,
          severity: item.severity,
          status: item.status,
          owner: item.ownerOrg?.name ?? item.owner ?? 'Platform queue',
          ownerOrgId: item.ownerOrgId,
          entityType: 'compliance_case',
          entityRef: item.id,
          summary: payloadSummary(jsonObject(item.payload)) || `${item.severity} compliance review requires admin attention.`,
          createdAt: item.createdAt.toISOString()
        })),
        weeklyComplianceActions,
        evaluationOversight: (result.evaluationOversight ?? []).map((item) => ({
          id: item.id,
          tenderTitle: item.tender.title,
          reference: item.tender.reference,
          buyer: item.buyerOrg.name,
          status: item.status,
          stage: item.currentStage,
          progress: item.progress,
          updatedAt: item.updatedAt.toISOString()
        })),
        exceptionLog: (result.exceptionLog ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          severity: item.severity,
          status: item.status,
          owner: item.ownerOrg?.name ?? item.owner ?? 'Platform',
          summary: payloadSummary(jsonObject(item.payload)) || 'Compliance exception recorded for admin review.',
          createdAt: item.createdAt.toISOString()
        })),
        checklistPreview: (result.checklistPreview ?? []).map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
          status: item.status,
          severity: item.severity
        })),
        openComplianceItems: result.openComplianceItems.map(caseDto),
        recentActions: result.recentActions.map(adminActionDto),
        generatedAt: new Date().toISOString()
      };
    });
  }

  async users(token: string | undefined, query: UserListQuery): Promise<PageDto<AdminUserDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.users(query, tx);
      return page(result.items.map(userDto), query, result.total);
    });
  }

  async suspendUser(token: string | undefined, userId: string, input: AdminUserActionInput): Promise<AdminUserDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const before = await this.repository.userForAdmin(userId, tx);
      if (!before) throw requestError('User was not found.', 404);
      const previousMemberships = await this.repository.suspendUserMemberships(userId, tx);
      if (input.revokeSessions) await this.repository.revokeUserSessions(userId, tx);
      const after = await this.repository.userForAdmin(userId, tx);
      if (!after) throw requestError('User was not found after suspension.', 404);
      await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.HOLD,
        entityType: 'user',
        entityRef: userId,
        ownerOrgId: after.memberships[0]?.organizationId ?? null,
        summary: input.note ?? `Suspended ${after.displayName}.`,
        payload: { note: input.note ?? '', revokeSessions: Boolean(input.revokeSessions) },
        previousState: { memberships: previousMemberships.map((item) => ({ id: item.id, status: item.status })) },
        nextState: { membershipStatus: 'SUSPENDED' },
        reversible: true
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: after.memberships[0]?.organizationId ?? null,
        event: 'admin.user.suspended',
        entityType: 'user',
        entityRef: userId,
        severity: AuditSeverity.WARNING,
        payload: { note: input.note ?? '', revokeSessions: Boolean(input.revokeSessions) }
      }, tx);
      return userDto(after);
    });
  }

  async reinstateUser(token: string | undefined, userId: string, input: AdminNoteInput): Promise<AdminUserDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const before = await this.repository.userForAdmin(userId, tx);
      if (!before) throw requestError('User was not found.', 404);
      await this.repository.reinstateUserMemberships(userId, tx);
      const after = await this.repository.userForAdmin(userId, tx);
      if (!after) throw requestError('User was not found after reinstatement.', 404);
      await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.APPROVE,
        entityType: 'user',
        entityRef: userId,
        ownerOrgId: after.memberships[0]?.organizationId ?? null,
        summary: input.note ?? `Reinstated ${after.displayName}.`,
        previousState: { membershipStatus: before.memberships[0]?.status ?? null },
        nextState: { membershipStatus: after.memberships[0]?.status ?? null },
        reversible: true
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: after.memberships[0]?.organizationId ?? null,
        event: 'admin.user.reinstated',
        entityType: 'user',
        entityRef: userId,
        severity: AuditSeverity.INFO,
        payload: { note: input.note ?? '' }
      }, tx);
      return userDto(after);
    });
  }

  async resetUserAccess(token: string | undefined, userId: string, input: AdminNoteInput): Promise<AdminActionDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const user = await this.repository.userForAdmin(userId, tx);
      if (!user) throw requestError('User was not found.', 404);
      const resetToken = randomToken();
      const challenge = await this.repository.createIdentityChallenge({
        userId,
        purpose: 'ADMIN_PASSWORD_RESET',
        target: user.email,
        codeHash: sha256(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        metadata: { requestedByAdminUserId: admin.user.id, note: input.note ?? '', delivery: 'PENDING_EMAIL' }
      }, tx);
      await this.repository.revokeUserSessions(userId, tx);
      const action = await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.RETURN,
        entityType: 'user',
        entityRef: userId,
        ownerOrgId: user.memberships[0]?.organizationId ?? null,
        summary: input.note ?? `Reset access created for ${user.displayName}.`,
        payload: { challengeId: challenge.id, delivery: 'PENDING_EMAIL' },
        reversible: false
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: user.memberships[0]?.organizationId ?? null,
        event: 'admin.user.access_reset_requested',
        entityType: 'user',
        entityRef: userId,
        severity: AuditSeverity.WARNING,
        payload: { challengeId: challenge.id, delivery: 'PENDING_EMAIL' }
      }, tx);
      return adminActionDto(action);
    });
  }

  async revokeUserSessions(token: string | undefined, userId: string, input: AdminNoteInput): Promise<AdminActionDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const user = await this.repository.userForAdmin(userId, tx);
      if (!user) throw requestError('User was not found.', 404);
      const result = await this.repository.revokeUserSessions(userId, tx);
      const action = await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.HOLD,
        entityType: 'user',
        entityRef: userId,
        ownerOrgId: user.memberships[0]?.organizationId ?? null,
        summary: input.note ?? `Revoked ${result.count} active sessions for ${user.displayName}.`,
        payload: { revokedSessions: result.count, note: input.note ?? '' },
        reversible: false
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: user.memberships[0]?.organizationId ?? null,
        event: 'admin.user.sessions_revoked',
        entityType: 'user',
        entityRef: userId,
        severity: AuditSeverity.WARNING,
        payload: { revokedSessions: result.count, note: input.note ?? '' }
      }, tx);
      return adminActionDto(action);
    });
  }

  async inviteUser(token: string | undefined, input: AdminUserInviteInput): Promise<AdminUserDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const accountType = input.accountType === 'ADMIN' ? AccountType.ADMIN : AccountType.USER;
      const user = await this.repository.createInvitedUser({
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        accountType,
        metadata: { invitedByAdminUserId: admin.user.id, inviteStatus: 'PENDING', inviteNote: input.note ?? '' }
      }, tx);
      const inviteToken = randomToken();
      const challenge = await this.repository.createIdentityChallenge({
        userId: user.id,
        purpose: 'ADMIN_INVITE',
        target: user.email,
        codeHash: sha256(inviteToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        metadata: { requestedByAdminUserId: admin.user.id, delivery: 'PENDING_EMAIL', note: input.note ?? '' }
      }, tx);
      await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.REVIEW,
        entityType: 'user',
        entityRef: user.id,
        summary: `Invited ${user.displayName}.`,
        payload: { challengeId: challenge.id, delivery: 'PENDING_EMAIL', note: input.note ?? '' },
        reversible: false
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        event: 'admin.user.invited',
        entityType: 'user',
        entityRef: user.id,
        severity: AuditSeverity.INFO,
        payload: { challengeId: challenge.id, delivery: 'PENDING_EMAIL' }
      }, tx);
      return userDto(user);
    });
  }

  async search(token: string | undefined, query: SearchQuery): Promise<PageDto<SearchResultDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const indexed = await searchComplianceIndex(query).catch(() => null);
      if (indexed) return indexed;
      const result = await this.repository.search(query, tx);
      const unsortedItems: SearchResultDto[] = [
        ...result.users.map((item) => ({
          id: item.id,
          type: 'user',
          title: item.displayName,
          subtitle: item.email,
          status: item.verificationStatus,
          stage: item.accountType,
          party: item.email,
          summary: `Verification status is ${item.verificationStatus}.`,
          routeHint: '/admin/users',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        })),
        ...result.organizations.map((item) => ({
          id: item.id,
          type: 'organization',
          title: item.name,
          subtitle: item.taxId ?? item.kind,
          stage: item.kind,
          party: item.country ?? null,
          summary: item.taxId ? `Tax ID ${item.taxId}` : 'Organization registry record.',
          routeHint: '/admin/users',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        })),
        ...result.tenders.map((item) => ({
          id: item.id,
          type: 'tender',
          title: item.title,
          subtitle: item.reference,
          status: item.status,
          stage: item.method ?? item.type,
          party: item.buyerOrg?.name ?? null,
          amount: money(item.budget, item.currency),
          summary: item.description ?? `${item.type} tender in ${item.status}.`,
          routeHint: '/procurement/tender-details',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        })),
        ...result.bids.map((item) => ({
          id: item.id,
          type: 'bid',
          title: item.reference,
          subtitle: item.tender.title,
          status: item.status,
          party: item.supplierOrg?.name ?? item.buyerOrg?.name ?? null,
          amount: money(item.totalAmount, item.currency),
          summary: `Bid for ${item.tender.reference}.`,
          routeHint: '/bidding',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        })),
        ...result.contracts.map((item) => ({
          id: item.id,
          type: 'contract',
          title: item.title,
          subtitle: item.reference,
          status: item.status,
          party: item.supplierOrg?.name ?? item.buyerOrg?.name ?? null,
          amount: money(item.amount, item.currency),
          summary: `Contract between ${item.buyerOrg?.name ?? 'buyer'} and ${item.supplierOrg?.name ?? 'supplier'}.`,
          routeHint: '/awards-contracts/negotiation',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        })),
        ...result.auditEvents.map((item) => ({
          id: item.id,
          type: 'audit-event',
          title: item.event,
          subtitle: item.entityRef ? `${item.entityType} ${item.entityRef}` : item.entityType,
          status: item.severity,
          stage: item.actorUser?.accountType ?? 'SYSTEM',
          party: item.actorUser?.displayName ?? null,
          summary: payloadSummary(jsonObject(item.payload)) || `Audit event for ${item.entityType}.`,
          routeHint: '/admin/audit',
          createdAt: item.createdAt.toISOString()
        })),
        ...result.records.map((item) => ({
          id: item.id,
          type: 'record',
          title: item.title,
          subtitle: item.entityRef ? `${item.entityType} ${item.entityRef}` : item.entityType,
          stage: item.entityType,
          summary: 'Archive record entry.',
          routeHint: '/records',
          createdAt: item.createdAt.toISOString()
        })),
        ...(result.documents ?? []).map((item) => ({
          id: item.id,
          type: 'document',
          title: item.name,
          subtitle: item.documentType,
          stage: item.documentType,
          party: item.ownerOrg?.name ?? item.uploadedByUser?.displayName ?? null,
          summary: item.uploadedByUser?.email ? `Uploaded by ${item.uploadedByUser.email}.` : 'Document object.',
          routeHint: '/records',
          createdAt: item.createdAt.toISOString()
        })),
        ...(result.evaluations ?? []).map((item) => ({
          id: item.id,
          type: 'evaluation',
          title: item.tender.title,
          subtitle: item.tender.reference,
          status: item.status,
          stage: item.currentStage,
          party: item.buyerOrg.name,
          summary: `Evaluation progress ${item.progress}%.`,
          routeHint: '/evaluation',
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        })),
        ...(result.awards ?? []).map((item) => ({
          id: item.id,
          type: 'award',
          title: item.workspace.tender.title,
          subtitle: item.workspace.tender.reference,
          status: item.status,
          party: item.workspace.buyerOrg.name,
          amount: money(item.amount, item.currency),
          summary: item.reason ?? 'Award recommendation.',
          routeHint: '/awards-contracts/award-response',
          createdAt: item.createdAt.toISOString()
        })),
        ...(result.complianceCases ?? []).map((item) => ({
          id: item.id,
          type: 'compliance',
          title: item.title,
          subtitle: item.ownerOrg?.name ?? item.owner ?? 'Platform',
          status: item.status,
          stage: item.severity,
          party: item.ownerOrg?.name ?? item.owner ?? null,
          summary: payloadSummary(jsonObject(item.payload)) || 'Compliance case.',
          routeHint: '/admin/audit',
          createdAt: item.createdAt.toISOString()
        }))
      ];
      const items = unsortedItems.sort((left, right) => (right.updatedAt ?? right.createdAt ?? '').localeCompare(left.updatedAt ?? left.createdAt ?? ''));

      const start = (query.page - 1) * query.pageSize;
      return page(items.slice(start, start + query.pageSize), query, items.length);
    });
  }

  async reindexSearch(token: string | undefined) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const query: SearchQuery = { q: '', page: 1, pageSize: 1000 };
      const result = await this.repository.search(query, tx);
      const documents: SearchIndexDocument[] = [
        ...result.users.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'user',
            title: item.displayName,
            subtitle: item.email,
            status: item.verificationStatus,
            stage: item.accountType,
            party: item.email,
            summary: `Verification status is ${item.verificationStatus}.`,
            routeHint: '/admin/users',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString()
          })
        ),
        ...result.organizations.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'organization',
            title: item.name,
            subtitle: item.taxId ?? item.kind,
            stage: item.kind,
            party: item.country,
            summary: item.taxId ? `Tax ID ${item.taxId}` : 'Organization registry record.',
            routeHint: '/admin/users',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString()
          })
        ),
        ...result.tenders.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'tender',
            title: item.title,
            subtitle: item.reference,
            status: item.status,
            stage: item.method ?? item.type,
            party: item.buyerOrg?.name ?? null,
            amount: money(item.budget, item.currency),
            summary: item.description ?? `${item.type} tender in ${item.status}.`,
            routeHint: '/procurement/tender-details',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString()
          })
        ),
        ...result.documents.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'document',
            title: item.name,
            subtitle: item.documentType,
            stage: item.documentType,
            party: item.ownerOrg?.name ?? item.uploadedByUser?.displayName ?? null,
            summary: item.uploadedByUser?.email ? `Uploaded by ${item.uploadedByUser.email}.` : 'Document object.',
            routeHint: '/records',
            createdAt: item.createdAt.toISOString()
          })
        ),
        ...result.auditEvents.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'audit-event',
            title: item.event,
            subtitle: item.entityRef ? `${item.entityType} ${item.entityRef}` : item.entityType,
            status: item.severity,
            stage: item.actorUser?.accountType ?? 'SYSTEM',
            party: item.actorUser?.displayName ?? null,
            summary: `Audit event for ${item.entityType}.`,
            routeHint: '/admin/audit',
            createdAt: item.createdAt.toISOString()
          })
        ),
        ...result.complianceCases.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'compliance',
            title: item.title,
            subtitle: item.ownerOrg?.name ?? item.owner ?? 'Platform',
            status: item.status,
            stage: item.severity,
            party: item.ownerOrg?.name ?? item.owner ?? null,
            summary: 'Compliance case.',
            routeHint: '/admin/audit',
            createdAt: item.createdAt.toISOString()
          })
        ),
        ...result.evaluations.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'evaluation',
            title: item.tender.title,
            subtitle: item.tender.reference,
            status: item.status,
            stage: item.currentStage,
            party: item.buyerOrg.name,
            summary: `Evaluation progress ${item.progress}%.`,
            routeHint: '/evaluation',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString()
          })
        ),
        ...result.awards.map((item) =>
          searchIndexDocument({
            id: item.id,
            type: 'award',
            title: item.workspace.tender.title,
            subtitle: item.workspace.tender.reference,
            status: item.status,
            party: item.workspace.buyerOrg.name,
            amount: money(item.amount, item.currency),
            summary: item.reason ?? 'Award recommendation.',
            routeHint: '/awards-contracts/award-response',
            createdAt: item.createdAt.toISOString()
          })
        )
      ];
      const rebuild = await rebuildComplianceIndex(documents);
      await this.repository.createAuditEvent(
        {
          actorUserId: admin.user.id,
          event: 'compliance.search.reindexed',
          entityType: 'compliance_search_index',
          severity: AuditSeverity.INFO,
          payload: { ...rebuild, documentCount: documents.length }
        },
        tx
      );
      return {
        ...rebuild,
        documentCount: documents.length,
        generatedAt: new Date().toISOString()
      };
    });
  }

  async cases(token: string | undefined, query: CaseListQuery): Promise<PageDto<ComplianceCaseDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.cases(query, tx);
      return page(result.items.map(caseDto), query, result.total);
    });
  }

  async updateCase(token: string | undefined, id: string, input: CaseUpdateInput): Promise<ComplianceCaseDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const before = await this.repository.caseById(id, tx);
      if (!before) throw requestError('Compliance case was not found.', 404);
      const updated = await this.repository.updateCase(id, input, tx);
      await this.repository.createAdminAction(
        admin.user.id,
        {
          ownerOrgId: updated.ownerOrgId,
          actionType: AdminActionType.REVIEW,
          entityType: 'compliance_case',
          entityRef: updated.id,
          summary: `Compliance case updated to ${updated.status}.`,
          payload: input,
          previousState: caseState(before),
          nextState: caseState(updated),
          reversible: true
        },
        tx
      );
      await this.repository.createAuditEvent(
        {
          actorUserId: admin.user.id,
          ownerOrgId: updated.ownerOrgId,
          event: 'compliance.case.admin_updated',
          entityType: 'compliance_case',
          entityRef: updated.id,
          severity: updated.severity,
          payload: input as Prisma.InputJsonObject
        },
        tx
      );
      return caseDto(updated);
    });
  }

  async rules(token: string | undefined, query: RuleListQuery): Promise<PageDto<ComplianceRuleDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.rules(query, tx);
      return page(result.items.map(ruleDto), query, result.total);
    });
  }

  async createRule(token: string | undefined, input: RuleCreateInput): Promise<ComplianceRuleDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const created = await this.repository.createRule({ ...input, createdByUserId: admin.user.id }, tx);
      await this.repository.createAdminAction(
        admin.user.id,
        {
          ownerOrgId: created.ownerOrgId,
          actionType: AdminActionType.REVIEW,
          entityType: 'compliance_rule',
          entityRef: created.id,
          summary: `Created compliance rule ${created.code}.`
        },
        tx
      );
      await this.repository.createAuditEvent(
        {
          actorUserId: admin.user.id,
          ownerOrgId: created.ownerOrgId,
          event: 'compliance.rule.created',
          entityType: 'compliance_rule',
          entityRef: created.id,
          severity: created.severity,
          payload: { code: created.code, status: created.status }
        },
        tx
      );
      return ruleDto(created);
    });
  }

  async updateRule(token: string | undefined, id: string, input: RuleUpdateInput): Promise<ComplianceRuleDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const before = await this.repository.ruleById(id, tx);
      if (!before) throw requestError('Compliance rule was not found.', 404);
      const updated = await this.repository.updateRule(id, input, tx);
      await this.repository.createAdminAction(
        admin.user.id,
        {
          ownerOrgId: updated.ownerOrgId,
          actionType: AdminActionType.REVIEW,
          entityType: 'compliance_rule',
          entityRef: updated.id,
          summary: `Updated compliance rule ${updated.code}.`,
          payload: input,
          previousState: ruleState(before),
          nextState: ruleState(updated),
          reversible: true
        },
        tx
      );
      await this.repository.createAuditEvent(
        {
          actorUserId: admin.user.id,
          ownerOrgId: updated.ownerOrgId,
          event: 'compliance.rule.updated',
          entityType: 'compliance_rule',
          entityRef: updated.id,
          severity: updated.severity,
          payload: input as Prisma.InputJsonObject
        },
        tx
      );
      return ruleDto(updated);
    });
  }

  async complianceReviews(token: string | undefined, query: { page: number; pageSize: number; [key: string]: unknown }) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.complianceReviews(query, tx);
      return page(result.items.map((item) => workflowDto(item as unknown as Record<string, unknown>)), query, result.total);
    });
  }

  async createComplianceReview(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const item = await this.repository.createComplianceReview(input, admin.user.id, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: typeof input.ownerOrgId === 'string' ? input.ownerOrgId : null,
        event: 'compliance.review.created',
        entityType: 'compliance_review',
        entityRef: item.id,
        severity: AuditSeverity.WARNING,
        payload: jsonObject(input.payload) as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async violationCases(token: string | undefined, query: { page: number; pageSize: number; [key: string]: unknown }) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.violationCases(query, tx);
      return page(result.items.map((item) => workflowDto(item as unknown as Record<string, unknown>)), query, result.total);
    });
  }

  async createViolationCase(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const item = await this.repository.createViolationCase(input, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: typeof input.ownerOrgId === 'string' ? input.ownerOrgId : null,
        event: 'compliance.violation.created',
        entityType: 'violation_case',
        entityRef: item.id,
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        payload: jsonObject(input.payload) as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async createViolationEvidence(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const item = await this.repository.createViolationEvidence(input, admin.user.id, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        event: 'compliance.violation_evidence.created',
        entityType: 'violation_evidence',
        entityRef: item.id,
        severity: AuditSeverity.INFO,
        payload: jsonObject(input.payload) as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async enforcementRecords(token: string | undefined, query: { page: number; pageSize: number; [key: string]: unknown }) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.enforcementRecords(query, tx);
      return page(result.items.map((item) => workflowDto(item as unknown as Record<string, unknown>)), query, result.total);
    });
  }

  async createEnforcementRecord(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const item = await this.repository.createEnforcementRecord(input, admin.user.id, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: typeof input.supplierOrgId === 'string' ? input.supplierOrgId : null,
        event: 'compliance.enforcement.created',
        entityType: 'enforcement_record',
        entityRef: item.id,
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        payload: jsonObject(input.payload) as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async appealRecords(token: string | undefined, query: { page: number; pageSize: number; [key: string]: unknown }) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.appealRecords(query, tx);
      return page(result.items.map((item) => workflowDto(item as unknown as Record<string, unknown>)), query, result.total);
    });
  }

  async createAppealRecord(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const item = await this.repository.createAppealRecord(input, admin.user.id, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: typeof input.appellantOrgId === 'string' ? input.appellantOrgId : null,
        event: 'compliance.appeal.created',
        entityType: 'appeal_record',
        entityRef: item.id,
        severity: AuditSeverity.INFO,
        payload: jsonObject(input.payload) as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async collusionAlerts(token: string | undefined, query: { page: number; pageSize: number; [key: string]: unknown }) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.collusionAlerts(query, tx);
      return page(result.items.map((item) => workflowDto(item as unknown as Record<string, unknown>)), query, result.total);
    });
  }

  async createCollusionAlert(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const item = await this.repository.createCollusionAlert(input, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: typeof input.supplierOrgId === 'string' ? input.supplierOrgId : null,
        event: 'compliance.collusion_alert.created',
        entityType: 'collusion_alert',
        entityRef: item.id,
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        payload: jsonObject(input.payload) as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async supplierRiskProfiles(token: string | undefined, query: { page: number; pageSize: number; [key: string]: unknown }) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.supplierRiskProfiles(query, tx);
      return page(result.items.map((item) => workflowDto(item as unknown as Record<string, unknown>)), query, result.total);
    });
  }

  async upsertSupplierRiskProfile(token: string | undefined, input: Record<string, unknown>) {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.upsertSupplierRiskProfile(input, admin.user.id, tx);
      const item = result.profile;
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: typeof input.supplierOrgId === 'string' ? input.supplierOrgId : null,
        event: 'compliance.supplier_risk_profile.upserted',
        entityType: 'supplier_risk_profile',
        entityRef: item.id,
        severity: AuditSeverity.INFO,
        payload: {
          previous: result.previous ? {
            riskLevel: result.previous.riskLevel,
            riskScore: result.previous.riskScore,
            trustTier: result.previous.trustTier,
            activeAlerts: result.previous.activeAlerts,
            openViolations: result.previous.openViolations,
            summary: result.previous.summary
          } : null,
          next: {
            riskLevel: item.riskLevel,
            riskScore: item.riskScore,
            trustTier: item.trustTier,
            activeAlerts: item.activeAlerts,
            openViolations: item.openViolations,
            summary: item.summary
          },
          reason: typeof input.summary === 'string' ? input.summary : '',
          payload: jsonObject(input.payload)
        } as Prisma.InputJsonObject
      }, tx);
      return workflowDto(item as unknown as Record<string, unknown>);
    });
  }

  async auditEvents(token: string | undefined, query: AuditListQuery): Promise<PageDto<AuditEventDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.auditEvents(query, tx);
      return page(result.items.map(auditEventDto), query, result.total);
    });
  }

  async analytics(token: string | undefined, query: AnalyticsQuery = {}): Promise<AnalyticsDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.analytics(query, tx);
      const tenderRows = result.tenderRows ?? [];
      const bidRows = result.bidRows ?? [];
      const evaluationRows = result.evaluationRows ?? [];
      const awardRows = result.awardRows ?? [];
      const complianceRows = result.complianceRows ?? [];
      const procurementValue = tenderRows.reduce((sum, item) => sum + decimalNumber(item.budget), 0);
      const completedEvaluations = evaluationRows.filter((item) => item.status === 'COMPLETED');
      const avgEvaluationDurationDays = averageDays(completedEvaluations.map((item) => [item.createdAt, item.updatedAt]));
      const avgAwardCycleDays = averageDays(awardRows.map((item) => [item.workspace.tender.createdAt, item.createdAt]));
      const procurementByCategory = Array.from(
        tenderRows
          .reduce((map, item) => {
            const category = item.categories[0]?.name ?? item.type;
            const current = map.get(category) ?? { category, count: 0, value: 0 };
            current.count += 1;
            current.value += decimalNumber(item.budget);
            map.set(category, current);
            return map;
          }, new Map<string, { category: string; count: number; value: number }>())
          .values()
      ).sort((left, right) => right.value - left.value);
      const procurementTypeBreakdown = Array.from(
        tenderRows
          .reduce((map, item) => {
            const current = map.get(item.type) ?? { type: item.type, tenders: 0, totalValue: 0, bidCount: 0 };
            current.tenders += 1;
            current.totalValue += decimalNumber(item.budget);
            current.bidCount += item.bids.length;
            map.set(item.type, current);
            return map;
          }, new Map<string, { type: string; tenders: number; totalValue: number; bidCount: number }>())
          .values()
      ).map((item) => ({
        type: item.type,
        tenders: item.tenders,
        totalValue: item.totalValue,
        avgBidsPerTender: item.tenders ? Number((item.bidCount / item.tenders).toFixed(1)) : 0,
        avgDaysToAward: avgAwardCycleDays
      }));
      const topBuyers = topAggregate(tenderRows.map((item) => ({ key: item.buyerOrg.name, value: decimalNumber(item.budget) }))).map((item) => ({
        organization: item.key,
        tenders: item.count,
        value: item.value
      }));
      const topSuppliers = topAggregate(bidRows.map((item) => ({ key: item.supplierOrg.name, value: decimalNumber(item.totalAmount) }))).map((item) => ({
        organization: item.key,
        bids: item.count,
        value: item.value
      }));
      return {
        totals: result.totals,
        range: {
          from: query.from?.toISOString() ?? null,
          to: query.to?.toISOString() ?? null
        },
        procurementValue,
        tendersPublished: tenderRows.filter((item) => item.publishedAt).length,
        avgEvaluationDurationDays,
        avgAwardCycleDays,
        usersByVerificationStatus: result.usersByVerificationStatus.map((item) => ({ status: item.verificationStatus, count: item._count._all })),
        tendersByStatus: result.tendersByStatus.map((item) => ({ status: item.status, count: item._count._all })),
        bidsByStatus: result.bidsByStatus.map((item) => ({ status: item.status, count: item._count._all })),
        complianceByStatus: result.complianceByStatus.map((item) => ({ status: item.status, count: item._count._all })),
        auditBySeverity: result.auditBySeverity.map((item) => ({ severity: item.severity, count: item._count._all })),
        procurementByCategory,
        tenderStatusMix: result.tendersByStatus.map((item) => ({ status: item.status, count: item._count._all })),
        procurementTypeBreakdown,
        topBuyers,
        topSuppliers,
        complianceTrend: complianceTrend(complianceRows),
        generatedAt: new Date().toISOString()
      };
    });
  }

  async dataStoreNamespaces(token: string | undefined, query: DataStoreNamespaceQuery): Promise<{ items: DataStoreNamespaceDto[]; generatedAt: string }> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const rows = await this.repository.dataStoreNamespaces(query, tx);
      return {
        items: rows.map((row) => ({
          namespace: row.namespace,
          scope: row.scope as DataStoreNamespaceDto['scope'],
          total: row._count._all,
          updatedAt: row._max.updatedAt?.toISOString() ?? null
        })),
        generatedAt: new Date().toISOString()
      };
    });
  }

  async dataStoreEntries(token: string | undefined, query: DataStoreEntryQuery): Promise<PageDto<DataStoreEntryDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.dataStoreEntries(query, tx);
      return page(result.items.map(dataStoreEntryDto), query, result.total);
    });
  }

  async dataStoreEntry(token: string | undefined, id: string): Promise<DataStoreEntryDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const entry = await this.repository.dataStoreEntry(id, tx);
      if (!entry) throw requestError('Data store entry was not found.', 404);
      return dataStoreEntryDto(entry);
    });
  }

  async dataStoreEntryVersions(token: string | undefined, id: string): Promise<{ items: DataStoreEntryVersionDto[]; generatedAt: string }> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const entry = await this.repository.dataStoreEntry(id, tx);
      if (!entry) throw requestError('Data store entry was not found.', 404);
      const versions = await this.repository.dataStoreEntryVersions(id, tx);
      return { items: versions.map(dataStoreVersionDto), generatedAt: new Date().toISOString() };
    });
  }

  async createDataStoreEntry(token: string | undefined, input: DataStoreEntryCreateInput): Promise<DataStoreEntryDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const created = await this.repository.createDataStoreEntry({ ...input, actorUserId: admin.user.id }, tx);
      await this.auditDataStoreAction(admin.user.id, AdminActionType.REVIEW, 'created', created, tx);
      return dataStoreEntryDto(created);
    });
  }

  async updateDataStoreEntry(token: string | undefined, id: string, input: DataStoreEntryUpdateInput): Promise<DataStoreEntryDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const updated = await this.repository.updateDataStoreEntry(id, { ...input, actorUserId: admin.user.id }, tx);
      if (!updated) throw requestError('Data store entry was not found.', 404);
      await this.auditDataStoreAction(admin.user.id, AdminActionType.REVIEW, 'updated', updated, tx);
      return dataStoreEntryDto(updated);
    });
  }

  async deleteDataStoreEntry(token: string | undefined, id: string, input: DataStoreDeleteInput): Promise<DataStoreEntryDto> {
    const admin = await this.requireAdmin(token);
    if (input.confirm !== 'DELETE') throw requestError('Delete confirmation is required.');
    return this.asAdmin(admin, async (tx) => {
      const deleted = await this.repository.softDeleteDataStoreEntry(id, admin.user.id, tx);
      if (!deleted) throw requestError('Data store entry was not found.', 404);
      await this.auditDataStoreAction(admin.user.id, AdminActionType.HOLD, 'deleted', deleted, tx);
      return dataStoreEntryDto(deleted);
    });
  }

  async restoreDataStoreEntry(token: string | undefined, id: string, input: AdminNoteInput): Promise<DataStoreEntryDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const restored = await this.repository.restoreDataStoreEntry(id, admin.user.id, tx);
      if (!restored) throw requestError('Data store entry was not found.', 404);
      await this.auditDataStoreAction(admin.user.id, AdminActionType.APPROVE, 'restored', restored, tx, input.note);
      return dataStoreEntryDto(restored);
    });
  }

  async restoreDataStoreVersion(token: string | undefined, versionId: string, input: AdminNoteInput): Promise<DataStoreEntryDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const restored = await this.repository.restoreDataStoreVersion(versionId, admin.user.id, tx);
      if (!restored) throw requestError('Data store version was not found.', 404);
      await this.auditDataStoreAction(admin.user.id, AdminActionType.RETURN, 'version_restored', restored, tx, input.note);
      return dataStoreEntryDto(restored);
    });
  }

  async exportDataStoreEntries(token: string | undefined, query: DataStoreEntryQuery): Promise<PageDto<DataStoreEntryDto>> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const result = await this.repository.dataStoreEntries({ ...query, page: 1, pageSize: Math.min(100, query.pageSize) }, tx);
      await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.EXPORT,
        entityType: 'data_store',
        entityRef: query.namespace ?? null,
        summary: `Exported ${result.items.length} data store entries.`
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        event: 'admin.datastore.exported',
        entityType: 'data_store',
        entityRef: query.namespace ?? null,
        severity: AuditSeverity.INFO,
        payload: { filters: query, count: result.items.length } as Prisma.InputJsonObject
      }, tx);
      return page(result.items.map(dataStoreEntryDto), { ...query, page: 1, pageSize: Math.min(100, query.pageSize) }, result.total);
    });
  }

  async recordAction(token: string | undefined, input: AdminActionInput): Promise<AdminActionDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      let previousState = input.previousState ?? {};
      let nextState = input.nextState ?? {};
      let reversible = input.reversible ?? false;
      if (input.entityType === 'user' && input.entityRef && input.actionType === AdminActionType.HOLD) {
        const previousMemberships = await this.repository.suspendUserMemberships(input.entityRef, tx);
        previousState = { memberships: previousMemberships.map((item) => ({ id: item.id, status: item.status })) };
        nextState = { membershipStatus: 'SUSPENDED' };
        reversible = true;
      }
      if (input.entityType === 'compliance_case' && input.entityRef) {
        const before = await this.repository.caseById(input.entityRef, tx);
        if (before) {
          const nextStatus = complianceStatusForAction(input.actionType, before.status);
          const updated = await this.repository.updateCase(input.entityRef, { status: nextStatus }, tx);
          previousState = caseState(before);
          nextState = caseState(updated);
          reversible = true;
        }
      }
      const action = await this.repository.createAdminAction(admin.user.id, { ...input, previousState, nextState, reversible }, tx);
      await this.repository.createAuditEvent(
        {
          actorUserId: admin.user.id,
          ownerOrgId: input.ownerOrgId,
          event: `admin.action.${input.actionType.toLowerCase()}`,
          entityType: input.entityType,
          entityRef: input.entityRef,
          severity: input.actionType === AdminActionType.HOLD || input.actionType === AdminActionType.FLAG ? AuditSeverity.WARNING : AuditSeverity.INFO,
          payload: { summary: input.summary ?? '' }
        },
        tx
      );
      return adminActionDto(action);
    });
  }

  async undoAction(token: string | undefined, id: string, input: AdminNoteInput): Promise<AdminActionDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const action = await this.repository.adminAction(id, tx);
      if (!action) throw requestError('Admin action was not found.', 404);
      if (!action.reversible) throw requestError('This admin action cannot be undone.', 409);
      if (action.revertedAt) throw requestError('This admin action has already been undone.', 409);
      const previousState = jsonObject(action.previousState);
      if (action.entityType === 'user') {
        const memberships = Array.isArray(previousState.memberships) ? previousState.memberships : [];
        await this.repository.restoreUserMembershipStatuses(
          memberships
            .map((item) => jsonObject(item))
            .filter((item) => typeof item.id === 'string' && Object.values(MemberStatus).includes(item.status as MemberStatus))
            .map((item) => ({ id: item.id as string, status: item.status as MemberStatus })),
          tx
        );
      } else if (action.entityType === 'compliance_case' && action.entityRef) {
        await this.repository.updateCase(action.entityRef, previousState as CaseUpdateInput, tx);
      } else if (action.entityType === 'compliance_rule' && action.entityRef) {
        await this.repository.updateRule(action.entityRef, previousState as RuleUpdateInput, tx);
      } else if (action.entityType === 'data_store' && action.entityRef) {
        if (previousState.deletedAt === null) await this.repository.restoreDataStoreEntry(action.entityRef, admin.user.id, tx);
        if ('value' in previousState) await this.repository.updateDataStoreEntry(action.entityRef, { value: previousState.value, actorUserId: admin.user.id }, tx);
      } else {
        throw requestError('This admin action does not have an undo handler.', 409);
      }
      const reverse = await this.repository.createAdminAction(admin.user.id, {
        ownerOrgId: action.ownerOrgId,
        actionType: AdminActionType.RETURN,
        entityType: action.entityType,
        entityRef: action.entityRef,
        summary: input.note ?? `Undid admin action ${action.id}.`,
        payload: { originalActionId: action.id, note: input.note ?? '' },
        previousState: jsonObject(action.nextState),
        nextState: previousState,
        reversible: false
      }, tx);
      await this.repository.markAdminActionReverted(action.id, admin.user.id, reverse.id, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: action.ownerOrgId,
        event: 'admin.action.undone',
        entityType: action.entityType,
        entityRef: action.entityRef,
        severity: AuditSeverity.WARNING,
        payload: { originalActionId: action.id, reverseActionId: reverse.id, note: input.note ?? '' }
      }, tx);
      return adminActionDto(reverse);
    });
  }

  async updateProfilePreferences(token: string | undefined, input: AdminProfilePreferencesInput): Promise<{ saved: true; action: AdminActionDto }> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      await this.repository.updateUserPreferences(admin.user.id, {
        preferredLanguage: input.preferredLanguage,
        timezone: input.timezone,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonObject
      }, tx);
      const action = await this.repository.createAdminAction(admin.user.id, {
        actionType: AdminActionType.REVIEW,
        entityType: 'admin_profile',
        entityRef: admin.user.id,
        summary: input.note ?? 'Updated admin profile preferences.',
        payload: { preferredLanguage: input.preferredLanguage, timezone: input.timezone, note: input.note ?? '' },
        reversible: false
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        event: 'admin.profile.preferences_updated',
        entityType: 'admin_profile',
        entityRef: admin.user.id,
        severity: AuditSeverity.INFO,
        payload: { preferredLanguage: input.preferredLanguage, timezone: input.timezone }
      }, tx);
      return { saved: true, action: adminActionDto(action) };
    });
  }

  async updateCommunicationState(token: string | undefined, id: string, state: 'read' | 'unread' | 'archive' | 'unarchive' | 'delete' | 'restore', input: AdminNoteInput): Promise<AdminActionDto> {
    const admin = await this.requireAdmin(token);
    return this.asAdmin(admin, async (tx) => {
      const data = communicationStateData(state);
      const updated = await this.repository.updateCommunicationMessage(id, data, tx);
      const action = await this.repository.createAdminAction(admin.user.id, {
        ownerOrgId: updated.ownerOrgId,
        actionType: state === 'delete' || state === 'archive' ? AdminActionType.HOLD : AdminActionType.REVIEW,
        entityType: 'communication_message',
        entityRef: id,
        summary: input.note ?? `Marked communication message ${state}.`,
        payload: { state, note: input.note ?? '' },
        nextState: { state },
        reversible: ['read', 'unread', 'archive', 'unarchive', 'delete', 'restore'].includes(state)
      }, tx);
      await this.repository.createAuditEvent({
        actorUserId: admin.user.id,
        ownerOrgId: updated.ownerOrgId,
        event: `admin.communication.${state}`,
        entityType: 'communication_message',
        entityRef: id,
        severity: state === 'delete' ? AuditSeverity.WARNING : AuditSeverity.INFO,
        payload: { note: input.note ?? '' }
      }, tx);
      return adminActionDto(action);
    });
  }

  private async auditDataStoreAction(actorUserId: string, actionType: AdminActionType, verb: string, entry: DataStoreEntryRow, tx: Prisma.TransactionClient, note?: string) {
    await this.repository.createAdminAction(
      actorUserId,
      {
        actionType,
        entityType: 'data_store',
        entityRef: entry.id,
        summary: `Data store entry ${entry.namespace}#${entry.key} ${verb}.`,
        payload: { namespace: entry.namespace, key: entry.key, scope: entry.scope, note: note ?? '' },
        previousState: verb === 'created' ? {} : { value: entry.value, deletedAt: verb === 'restored' ? entry.deletedAt : null },
        nextState: { value: entry.value, deletedAt: entry.deletedAt ?? null },
        reversible: ['updated', 'deleted', 'restored', 'version_restored'].includes(verb)
      },
      tx
    );
    await this.repository.createAuditEvent(
      {
        actorUserId,
        event: `admin.datastore.${verb}`,
        entityType: 'data_store',
        entityRef: entry.id,
        severity: verb === 'deleted' ? AuditSeverity.WARNING : AuditSeverity.INFO,
        payload: { namespace: entry.namespace, key: entry.key, scope: entry.scope } as Prisma.InputJsonObject
      },
      tx
    );
  }

  private async requireAdmin(token?: string) {
    if (!token) throw requestError('Authentication is required.', 401);
    const session = await withDbContext({ accountType: AccountType.ADMIN }, (tx) => this.repository.findActiveSession(sha256(token), tx));
    if (!session) throw requestError('Authentication is required.', 401);
    if (session.user.accountType !== AccountType.ADMIN) throw requestError('Admin access is required.', 403);
    return session;
  }

  private async asAdmin<T>(session: NonNullable<AdminSession>, work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return withDbContext(
      {
        userId: session.user.id,
        organizationId: session.organization?.id,
        accountType: AccountType.ADMIN
      },
      work
    );
  }
}

function decimalNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function money(value: Prisma.Decimal | number | string | null | undefined, currency?: string | null) {
  if (value === null || value === undefined) return null;
  return `${currency ?? 'TZS'} ${decimalNumber(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function payloadSummary(payload: Record<string, unknown>) {
  for (const key of ['summary', 'reason', 'message', 'description', 'issue']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function searchIndexDocument(item: SearchResultDto): SearchIndexDocument {
  return {
    ...item,
    searchText: [
      item.title,
      item.subtitle,
      item.status,
      item.stage,
      item.party,
      item.amount,
      item.summary,
      item.routeHint
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
  };
}

function weeklyBuckets(rows: Array<{ createdAt: Date }>) {
  const buckets = new Map<string, number>();
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const label = date.toLocaleDateString('en-US', { weekday: 'short' });
    buckets.set(label, 0);
  }
  for (const row of rows) {
    const label = row.createdAt.toLocaleDateString('en-US', { weekday: 'short' });
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([label, count]) => ({ label, count }));
}

function averageDays(pairs: Array<[Date, Date]>) {
  if (!pairs.length) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const average = pairs.reduce((sum, [from, to]) => sum + Math.max(0, to.getTime() - from.getTime()) / dayMs, 0) / pairs.length;
  return Number(average.toFixed(1));
}

function topAggregate(rows: Array<{ key: string; value: number }>) {
  return Array.from(
    rows
      .reduce((map, item) => {
        const current = map.get(item.key) ?? { key: item.key, count: 0, value: 0 };
        current.count += 1;
        current.value += item.value;
        map.set(item.key, current);
        return map;
      }, new Map<string, { key: string; count: number; value: number }>())
      .values()
  )
    .sort((left, right) => right.value - left.value || right.count - left.count)
    .slice(0, 6);
}

function complianceTrend(rows: Array<{ status: string; createdAt: Date }>) {
  const buckets = new Map<string, { label: string; total: number; resolved: number }>();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - index);
    const label = date.toLocaleDateString('en-US', { month: 'short' });
    buckets.set(label, { label, total: 0, resolved: 0 });
  }
  for (const row of rows) {
    const label = row.createdAt.toLocaleDateString('en-US', { month: 'short' });
    const bucket = buckets.get(label);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === 'RESOLVED' || row.status === 'FALSE_POSITIVE') bucket.resolved += 1;
  }
  return Array.from(buckets.values()).map((item) => ({
    ...item,
    rate: item.total ? Math.round((item.resolved / item.total) * 100) : 100
  }));
}

function userDto(user: AdminUserRow): AdminUserDto {
  const membership = user.memberships[0];
  const organization = membership?.organization;
  const latestScreening = user.screeningChecks[0];
  const verificationProfile = user.verificationProfiles[0];
  const documents = verificationProfile?.documents.map((item) => `${item.document.documentType}: ${item.document.name}`) ?? [];
  const history = (organization?.trustTierHistory ?? []).map((entry) => ({
    previousTier: entry.previousTier,
    nextTier: entry.nextTier,
    riskLevel: entry.riskLevel,
    score: entry.score,
    reasons: jsonArray(entry.reasons).map(String),
    createdAt: entry.createdAt.toISOString()
  }));
  const trustTier = organization?.supplierProfile?.trustTier ?? 'UNVERIFIED';
  const riskLevel = organization?.supplierProfile?.riskLevel ?? 'MEDIUM';
  const screeningStatus = latestScreening?.status ?? 'NOT_RUN';
  const verificationTimeline =
    verificationProfile?.history.map((item) => ({
      label: item.event,
      at: item.createdAt.toISOString(),
      detail: item.status
    })) ?? [];
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    accountType: user.accountType,
    verificationStatus: user.verificationStatus,
    role: membership?.title ?? user.accountType,
    membershipStatus: membership?.status ?? null,
    organization: organization
      ? {
          id: organization.id,
          name: organization.name,
          capabilities: organization.capabilities.map((item) => item.capability)
        }
      : null,
    trustTier,
    riskLevel,
    screeningStatus,
    trustRisk: {
      trustTier,
      riskLevel,
      screeningStatus,
      score: history[0]?.score ?? null,
      reasons: history[0]?.reasons ?? (trustTier === 'UNVERIFIED' ? ['Not assessed yet. Complete identity verification to receive a trust tier.'] : []),
      assessedAt: history[0]?.createdAt ?? null,
      history
    },
    permissions: user.permissionOverrides.map((item) => `${item.effect} ${item.permission}`),
    documents,
    timeline: [
      ...verificationTimeline,
      ...(user.sessions[0] ? [{ label: 'Last session', at: user.sessions[0].createdAt.toISOString(), detail: 'Session created' }] : []),
      { label: 'Account created', at: user.createdAt.toISOString(), detail: user.accountType }
    ].slice(0, 6),
    availableActions: userActions(membership?.status ?? null),
    lastSessionAt: user.sessions[0]?.createdAt.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function caseDto(item: ComplianceCaseRow): ComplianceCaseDto {
  return {
    id: item.id,
    title: item.title,
    severity: item.severity,
    status: item.status,
    owner: item.owner,
    ownerOrg: item.ownerOrg,
    payload: jsonObject(item.payload),
    availableActions: caseActions(item.status),
    createdAt: item.createdAt.toISOString()
  };
}

function ruleDto(item: ComplianceRuleRow): ComplianceRuleDto {
  return {
    id: item.id,
    ownerOrgId: item.ownerOrgId,
    code: item.code,
    title: item.title,
    description: item.description,
    severity: item.severity,
    status: item.status,
    condition: jsonObject(item.condition),
    payload: jsonObject(item.payload),
    createdByUserId: item.createdByUserId,
    availableActions: ruleActions(item.status),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function auditEventDto(item: AuditEventRow): AuditEventDto {
  return {
    id: item.id,
    event: item.event,
    entityType: item.entityType,
    entityRef: item.entityRef,
    severity: item.severity,
    ownerOrg: item.ownerOrg,
    actorUser: item.actorUser ? { id: item.actorUser.id, displayName: item.actorUser.displayName, email: item.actorUser.email } : null,
    actorRole: item.actorUser?.accountType ?? 'SYSTEM',
    summary: payloadSummary(jsonObject(item.payload)) || `${item.event} on ${item.entityType}.`,
    payload: jsonObject(item.payload),
    createdAt: item.createdAt.toISOString()
  };
}

function adminActionDto(item: AdminActionRow): AdminActionDto {
  return {
    id: item.id,
    actionType: item.actionType,
    entityType: item.entityType,
    entityRef: item.entityRef,
    summary: item.summary,
    payload: jsonObject(item.payload),
    previousState: jsonObject(item.previousState),
    nextState: jsonObject(item.nextState),
    reversible: item.reversible,
    revertedAt: item.revertedAt?.toISOString() ?? null,
    reverseActionId: item.reverseActionId,
    ownerOrg: item.ownerOrg,
    actorUser: item.actorUser,
    createdAt: item.createdAt.toISOString()
  };
}

function dataStoreEntryDto(item: DataStoreEntryRow): DataStoreEntryDto {
  return {
    id: item.id,
    scope: item.scope as DataStoreEntryDto['scope'],
    ownerUser: item.ownerUser,
    namespace: item.namespace,
    key: item.key,
    value: item.value,
    encrypted: item.encrypted,
    createdByUser: item.createdByUser,
    updatedByUser: item.updatedByUser,
    deletedByUser: item.deletedByUser,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    deletedAt: item.deletedAt?.toISOString() ?? null,
    availableActions: item.deletedAt ? ['restore'] : ['update', 'delete', 'copy', 'export']
  };
}

function dataStoreVersionDto(item: DataStoreEntryVersionRow): DataStoreEntryVersionDto {
  return {
    id: item.id,
    entryId: item.entryId,
    action: item.action,
    previousValue: item.previousValue,
    nextValue: item.nextValue,
    actorUser: item.actorUser,
    createdAt: item.createdAt.toISOString()
  };
}

function userActions(status: MemberStatus | string | null) {
  const base = ['view', 'reset_access', 'revoke_sessions'];
  if (status === MemberStatus.SUSPENDED) return [...base, 'reinstate'];
  return [...base, 'suspend'];
}

function caseActions(status: string) {
  if (status === ComplianceCaseStatus.RESOLVED || status === ComplianceCaseStatus.FALSE_POSITIVE) return ['reopen', 'assign'];
  return ['approve', 'flag', 'hold', 'return', 'assign', 'resolve'];
}

function ruleActions(status: string) {
  return status === 'ACTIVE' ? ['edit', 'disable', 'duplicate', 'test', 'archive'] : ['edit', 'enable', 'duplicate', 'restore'];
}

function caseState(item: ComplianceCaseRow): Record<string, unknown> {
  return {
    status: item.status,
    severity: item.severity,
    owner: item.owner,
    payload: jsonObject(item.payload)
  };
}

function ruleState(item: ComplianceRuleRow): Record<string, unknown> {
  return {
    ownerOrgId: item.ownerOrgId,
    code: item.code,
    title: item.title,
    description: item.description,
    severity: item.severity,
    status: item.status,
    condition: jsonObject(item.condition),
    payload: jsonObject(item.payload)
  };
}

function complianceStatusForAction(actionType: AdminActionType, current: ComplianceCaseStatus) {
  if (actionType === AdminActionType.APPROVE) return ComplianceCaseStatus.RESOLVED;
  if (actionType === AdminActionType.FLAG) return ComplianceCaseStatus.ESCALATED;
  if (actionType === AdminActionType.HOLD) return ComplianceCaseStatus.INVESTIGATION;
  if (actionType === AdminActionType.RETURN) return ComplianceCaseStatus.OPEN;
  return current;
}

function communicationStateData(state: 'read' | 'unread' | 'archive' | 'unarchive' | 'delete' | 'restore'): Prisma.CommunicationItemUpdateInput {
  if (state === 'read') return { read: true, status: CommunicationStatus.READ };
  if (state === 'unread') return { read: false, status: CommunicationStatus.UNREAD };
  if (state === 'archive') return { folder: 'archived', status: CommunicationStatus.ARCHIVED };
  if (state === 'unarchive') return { folder: 'inbox', status: CommunicationStatus.READ };
  if (state === 'delete') return { folder: 'trash', status: CommunicationStatus.DELETED };
  return { folder: 'inbox', status: CommunicationStatus.READ };
}
