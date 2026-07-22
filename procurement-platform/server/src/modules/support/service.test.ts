/* Exercises support behavior so regressions are caught close to the domain workflow they protect. */
import { AccountType, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ModuleService } from './service.js';
import { createTicketSchema, updateTicketStatusSchema } from './validators.js';

class FakeSupportRepository {
  tickets = new Map<string, any>();
  auditEvents: any[] = [];
  id = 0;

  nextId(prefix: string) {
    this.id += 1;
    return `${prefix}-${this.id}`;
  }

  health() {
    return Promise.resolve({ ready: true });
  }

  listTickets(where: any) {
    const tickets = Array.from(this.tickets.values()).filter((ticket) => {
      const statusMatches = !where.status || ticket.status === where.status;
      if (!statusMatches) return false;
      if (where.ownerOrgId) return ticket.ownerOrgId === where.ownerOrgId;
      if (!where.OR) return true;
      return where.OR.some((scope: any) => {
        if (scope.ownerUserId) return ticket.ownerUserId === scope.ownerUserId;
        if (scope.ownerOrgId) return ticket.ownerOrgId === scope.ownerOrgId;
        return false;
      });
    });
    return Promise.resolve(tickets);
  }

  findTicket(id: string) {
    return Promise.resolve(this.tickets.get(id) ?? null);
  }

  createTicket(input: any) {
    const now = new Date();
    const ticket = {
      id: this.nextId('ticket'),
      ownerUserId: input.ownerUserId,
      ownerOrgId: input.ownerOrgId,
      ownerUser: { displayName: 'Owner User' },
      ownerOrg: input.ownerOrgId ? { name: 'Owner Org' } : null,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: SupportTicketStatus.OPEN,
      description: input.description,
      payload: input.payload ?? {},
      comments: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      closedAt: null
    };
    this.tickets.set(ticket.id, ticket);
    return Promise.resolve(ticket);
  }

  addComment(ticketId: string, input: any) {
    const comment = {
      id: this.nextId('comment'),
      ticketId,
      actorUserId: input.actorUserId,
      actorUser: { displayName: 'Owner User' },
      body: input.body,
      visibility: input.visibility ?? 'PUBLIC',
      payload: input.payload ?? {},
      createdAt: new Date()
    };
    this.tickets.get(ticketId).comments.push(comment);
    return Promise.resolve(comment);
  }

  touchTicket(id: string, status?: SupportTicketStatus) {
    const ticket = this.tickets.get(id);
    if (status) ticket.status = status;
    ticket.updatedAt = new Date();
    if (status === SupportTicketStatus.RESOLVED) ticket.resolvedAt = new Date();
    return Promise.resolve(ticket);
  }

  createAuditEvent(input: any) {
    this.auditEvents.push({ id: this.nextId('audit'), ...input });
    return Promise.resolve(this.auditEvents.at(-1));
  }
}

class FakeIdentityService {
  constructor(private readonly sessions: Record<string, any>) {}

  requireSession(token?: string) {
    const session = token ? this.sessions[token] : null;
    if (!session) {
      const error = new Error('Authentication is required.') as Error & { status?: number };
      error.status = 401;
      return Promise.reject(error);
    }
    return Promise.resolve(session);
  }
}

class FakeSupportEmail {
  tickets: any[] = [];
  contacts: any[] = [];
  failTicket = false;

  sendTicketCreated(input: any) {
    this.tickets.push(input);
    if (this.failTicket) return Promise.reject(new Error('SMTP unavailable'));
    return Promise.resolve();
  }

  sendPublicContact(input: any) {
    this.contacts.push(input);
    return Promise.resolve();
  }
}

function makeService() {
  const repository = new FakeSupportRepository();
  const identity = new FakeIdentityService({
    buyer: {
      user: {
        id: 'user-1',
        email: 'buyer@example.test',
        displayName: 'Buyer User',
        accountType: AccountType.USER,
        organizationId: 'org-1'
      }
    },
    outsider: {
      user: {
        id: 'user-2',
        accountType: AccountType.USER,
        organizationId: 'org-2'
      }
    },
    admin: {
      user: {
        id: 'admin-1',
        email: 'admin@example.test',
        displayName: 'Admin User',
        accountType: AccountType.ADMIN
      }
    }
  });
  const supportEmail = new FakeSupportEmail();
  return { repository, service: new ModuleService(repository as any, identity as any, supportEmail as any), supportEmail };
}

describe('support module', () => {
  it('validates ticket payloads', () => {
    expect(createTicketSchema.parse({ subject: 'Help', description: 'I need account support.' })).toMatchObject({
      subject: 'Help',
      category: 'General',
      priority: SupportTicketPriority.NORMAL
    });
    expect(updateTicketStatusSchema.parse({ status: SupportTicketStatus.RESOLVED })).toEqual({ status: SupportTicketStatus.RESOLVED });
    expect(() => createTicketSchema.parse({ subject: 'No', description: 'short' })).toThrow();
  });

  it('creates, comments, scopes, and audits support tickets', async () => {
    const { repository, service, supportEmail } = makeService();
    const ticket = await service.createTicket(
      'buyer',
      {
        subject: 'Tender access',
        category: 'Technical',
        priority: SupportTicketPriority.HIGH,
        description: 'I cannot open the tender workspace.'
      },
      { language: 'sw' }
    );

    await service.addComment('buyer', ticket.id, { body: 'Please check my workspace.' });
    const updated = await service.updateStatus('buyer', ticket.id, SupportTicketStatus.RESOLVED);
    const list = await service.listTickets('buyer', {});

    expect(list.tickets).toHaveLength(1);
    expect(updated.status).toBe(SupportTicketStatus.RESOLVED);
    expect(repository.auditEvents.map((event) => event.event)).toEqual(
      expect.arrayContaining(['support.ticket.created', 'support.ticket.commented', 'support.ticket.status_changed'])
    );
    expect(supportEmail.tickets).toHaveLength(1);
    expect(supportEmail.tickets[0]).toMatchObject({
      id: ticket.id,
      ownerUserId: 'user-1',
      ownerEmail: 'buyer@example.test',
      organizationName: 'Owner Org',
      subject: 'Tender access',
      language: 'sw'
    });
    await expect(service.getTicket('outsider', ticket.id)).rejects.toMatchObject({ status: 403 });
    await expect(service.getTicket('admin', ticket.id)).resolves.toMatchObject({ id: ticket.id });
  });

  it('keeps ticket creation successful when support email delivery fails', async () => {
    const { repository, service, supportEmail } = makeService();
    supportEmail.failTicket = true;

    const ticket = await service.createTicket('buyer', {
      subject: 'Login support',
      category: 'Account access',
      priority: SupportTicketPriority.NORMAL,
      description: 'I cannot sign in to my account.'
    });

    expect(ticket.subject).toBe('Login support');
    expect(repository.auditEvents.map((event) => event.event)).toEqual(expect.arrayContaining(['support.ticket.created', 'support.ticket.email_failed']));
  });

  it('sends public contact requests to support email', async () => {
    const { repository, service, supportEmail } = makeService();

    await expect(
      service.publicContact(
        {
          fullName: 'Public User',
          email: 'public@example.test',
          phone: '+255700000001',
          organization: 'Public Org',
          requestType: 'General support',
          message: 'I need help before creating an account.'
        },
        { language: 'sw' }
      )
    ).resolves.toEqual({ status: 'sent' });

    expect(supportEmail.contacts).toEqual([
      expect.objectContaining({
        fullName: 'Public User',
        email: 'public@example.test',
        message: 'I need help before creating an account.',
        language: 'sw'
      })
    ]);
    expect(repository.auditEvents.map((event) => event.event)).toContain('support.public_contact.sent');
  });
});
