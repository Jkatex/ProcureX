import type { Request, RequestHandler } from 'express';
import { ModuleService } from './service.js';
import type { DataStoreEntryCreateInput } from './types.js';
import {
  adminActionSchema,
  adminNoteSchema,
  adminProfilePreferencesSchema,
  adminUserActionSchema,
  adminUserInviteSchema,
  analyticsQuerySchema,
  auditListQuerySchema,
  appealRecordBodySchema,
  caseListQuerySchema,
  caseUpdateSchema,
  collusionAlertBodySchema,
  complianceReviewBodySchema,
  dataStoreCreateSchema,
  dataStoreDeleteSchema,
  dataStoreEntryQuerySchema,
  dataStoreNamespaceQuerySchema,
  dataStoreUpdateSchema,
  enforcementRecordBodySchema,
  idParamsSchema,
  moduleStatusQuerySchema,
  communicationStateParamsSchema,
  ruleCreateSchema,
  ruleListQuerySchema,
  ruleUpdateSchema,
  searchQuerySchema,
  supplierRiskProfileBodySchema,
  userListQuerySchema,
  violationCaseBodySchema,
  violationEvidenceBodySchema,
  workflowListQuerySchema
} from './validators.js';
import { requestError } from '../shared/apiErrors.js';

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService()) {}

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  dashboard: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.dashboard(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  apps: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.apps(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  users: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.users(bearerToken(req), userListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  suspendUser: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid user id.');
      res.json(await this.service.suspendUser(bearerToken(req), params.data.id, adminUserActionSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  reinstateUser: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid user id.');
      res.json(await this.service.reinstateUser(bearerToken(req), params.data.id, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  resetUserAccess: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid user id.');
      res.status(201).json(await this.service.resetUserAccess(bearerToken(req), params.data.id, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  revokeUserSessions: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid user id.');
      res.status(201).json(await this.service.revokeUserSessions(bearerToken(req), params.data.id, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  inviteUser: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.inviteUser(bearerToken(req), adminUserInviteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  search: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.search(bearerToken(req), searchQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  reindexSearch: RequestHandler = async (req, res, next) => {
    try {
      res.status(202).json(await this.service.reindexSearch(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  cases: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.cases(bearerToken(req), caseListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  updateCase: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid compliance case id.');
      res.json(await this.service.updateCase(bearerToken(req), params.data.id, caseUpdateSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  rules: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.rules(bearerToken(req), ruleListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  createRule: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createRule(bearerToken(req), ruleCreateSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  updateRule: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid compliance rule id.');
      res.json(await this.service.updateRule(bearerToken(req), params.data.id, ruleUpdateSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  complianceReviews: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.complianceReviews(bearerToken(req), workflowListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  createComplianceReview: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createComplianceReview(bearerToken(req), complianceReviewBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  violationCases: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.violationCases(bearerToken(req), workflowListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  createViolationCase: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createViolationCase(bearerToken(req), violationCaseBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  createViolationEvidence: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createViolationEvidence(bearerToken(req), violationEvidenceBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  enforcementRecords: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.enforcementRecords(bearerToken(req), workflowListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  createEnforcementRecord: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createEnforcementRecord(bearerToken(req), enforcementRecordBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  appealRecords: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.appealRecords(bearerToken(req), workflowListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  createAppealRecord: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createAppealRecord(bearerToken(req), appealRecordBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  collusionAlerts: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.collusionAlerts(bearerToken(req), workflowListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  createCollusionAlert: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createCollusionAlert(bearerToken(req), collusionAlertBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  supplierRiskProfiles: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.supplierRiskProfiles(bearerToken(req), workflowListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  upsertSupplierRiskProfile: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.upsertSupplierRiskProfile(bearerToken(req), supplierRiskProfileBodySchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  auditEvents: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.auditEvents(bearerToken(req), auditListQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  analytics: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.analytics(bearerToken(req), analyticsQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  recordAction: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.recordAction(bearerToken(req), adminActionSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  undoAction: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid admin action id.');
      res.status(201).json(await this.service.undoAction(bearerToken(req), params.data.id, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  dataStoreNamespaces: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.dataStoreNamespaces(bearerToken(req), dataStoreNamespaceQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  dataStoreEntries: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.dataStoreEntries(bearerToken(req), dataStoreEntryQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  dataStoreEntry: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid data store entry id.');
      res.json(await this.service.dataStoreEntry(bearerToken(req), params.data.id));
    } catch (error) {
      next(error);
    }
  };

  dataStoreEntryVersions: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid data store entry id.');
      res.json(await this.service.dataStoreEntryVersions(bearerToken(req), params.data.id));
    } catch (error) {
      next(error);
    }
  };

  createDataStoreEntry: RequestHandler = async (req, res, next) => {
    try {
      res.status(201).json(await this.service.createDataStoreEntry(bearerToken(req), dataStoreCreateSchema.parse(req.body) as DataStoreEntryCreateInput));
    } catch (error) {
      next(error);
    }
  };

  updateDataStoreEntry: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid data store entry id.');
      res.json(await this.service.updateDataStoreEntry(bearerToken(req), params.data.id, dataStoreUpdateSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  deleteDataStoreEntry: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid data store entry id.');
      res.json(await this.service.deleteDataStoreEntry(bearerToken(req), params.data.id, dataStoreDeleteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  restoreDataStoreEntry: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid data store entry id.');
      res.json(await this.service.restoreDataStoreEntry(bearerToken(req), params.data.id, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  restoreDataStoreVersion: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid data store version id.');
      res.json(await this.service.restoreDataStoreVersion(bearerToken(req), params.data.id, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  exportDataStoreEntries: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.exportDataStoreEntries(bearerToken(req), dataStoreEntryQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  };

  updateProfilePreferences: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.updateProfilePreferences(bearerToken(req), adminProfilePreferencesSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };

  updateCommunicationState: RequestHandler = async (req, res, next) => {
    try {
      const params = communicationStateParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid communication state request.');
      res.status(201).json(await this.service.updateCommunicationState(bearerToken(req), params.data.id, params.data.state, adminNoteSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  };
}
