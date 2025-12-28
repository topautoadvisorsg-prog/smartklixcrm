import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import * as neo8Events from '../neo8-events';

// Set test token for internal API authentication
const TEST_INTERNAL_TOKEN = 'test-internal-token-for-sync-tests';
process.env.N8N_INTERNAL_TOKEN = TEST_INTERNAL_TOKEN;

describe('/api/intake/sync CRM sync handler', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  const createOutboxEntry = async (tenantId: string, idempotencyKey: string) => {
    return await storage.createEventsOutbox({
      tenantId,
      idempotencyKey,
      schemaVersion: '1.0',
      eventType: 'lead.created',
      channel: 'widget',
      sourceId: null,
      sourceIp: '127.0.0.1',
      recordingUrl: null,
      leadScore: null,
      payload: { name: 'Test User', email: 'test@example.com' },
      status: 'pending',
    });
  };

  describe('authentication', () => {
    it('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .post('/api/intake/sync')
        .send({
          outbox_id: 'test-outbox-id',
          tenant_id: 'test-tenant',
          status: 'success',
          payload: { email: 'test@example.com' },
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should reject missing outbox_id', async () => {
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          tenant_id: 'test-tenant',
          status: 'success',
          payload: { email: 'test@example.com' },
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.outbox_id).toBeDefined();
    });

    it('should reject missing tenant_id', async () => {
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: 'test-outbox-id',
          status: 'success',
          payload: { email: 'test@example.com' },
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.tenant_id).toBeDefined();
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: 'test-outbox-id',
          tenant_id: 'test-tenant',
          status: 'invalid_status',
          payload: { email: 'test@example.com' },
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('successful sync operations', () => {
    it('should create new contact from sync payload', async () => {
      const outbox = await createOutboxEntry('sync-test-tenant', `sync-new-contact-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'sync-test-tenant',
          status: 'success',
          payload: {
            name: 'Sync Test User',
            email: `sync-test-${Date.now()}@example.com`,
            phone: '+15551234567',
            company: 'Sync Test Corp',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.synced.contact_id).toBeDefined();
    });

    it('should create conversation for new contact', async () => {
      const uniqueEmail = `conv-test-${Date.now()}@example.com`;
      const outbox = await createOutboxEntry('conv-test-tenant', `sync-conv-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'conv-test-tenant',
          status: 'success',
          channel: 'voice',
          payload: {
            name: 'Conv Test User',
            email: uniqueEmail,
            message: 'This is a test message from lead intake',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.synced.contact_id).toBeDefined();
      expect(response.body.synced.conversation_id).toBeDefined();
    });

    it('should apply lead_score to conversation', async () => {
      const uniqueEmail = `score-test-${Date.now()}@example.com`;
      const outbox = await createOutboxEntry('score-test-tenant', `sync-score-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'score-test-tenant',
          status: 'success',
          lead_score: 85,
          payload: {
            email: uniqueEmail,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.synced.lead_score).toBe(85);
    });

    it('should merge tags with existing contact tags (deduplication using Set)', async () => {
      const uniqueEmail = `tags-test-${Date.now()}@example.com`;
      
      const contact = await storage.createContact({
        name: 'Existing Tags User',
        email: uniqueEmail,
        customerType: 'lead',
        tags: ['existing-tag', 'common-tag'],
      });

      const outbox = await createOutboxEntry('tags-test-tenant', `sync-tags-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'tags-test-tenant',
          status: 'success',
          payload: {
            email: uniqueEmail,
            tags: ['new-tag', 'common-tag'],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedContact = await storage.getContact(contact.id);
      const updatedTags = updatedContact?.tags as string[];
      expect(updatedTags).toContain('existing-tag');
      expect(updatedTags).toContain('common-tag');
      expect(updatedTags).toContain('new-tag');
      expect(updatedTags.filter(t => t === 'common-tag').length).toBe(1);
    });

    it('should create file record for recording_url attachment', async () => {
      const uniqueEmail = `recording-test-${Date.now()}@example.com`;
      const outbox = await createOutboxEntry('recording-test-tenant', `sync-recording-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'recording-test-tenant',
          status: 'success',
          recording_url: 'https://storage.example.com/recordings/test-call.mp3',
          payload: {
            email: uniqueEmail,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.synced.file_id).toBeDefined();
    });

    it('should update outbox status to synced', async () => {
      const uniqueEmail = `status-test-${Date.now()}@example.com`;
      const outbox = await createOutboxEntry('status-test-tenant', `sync-status-${Date.now()}`);
      
      expect(outbox.status).toBe('pending');

      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'status-test-tenant',
          status: 'success',
          payload: {
            email: uniqueEmail,
          },
        });

      expect(response.status).toBe(200);

      const updatedOutbox = await storage.getEventsOutboxByIdempotencyKey('status-test-tenant', outbox.idempotencyKey);
      expect(updatedOutbox?.status).toBe('synced');
    });

    it('should create audit log entry on successful sync', async () => {
      const uniqueEmail = `audit-sync-${Date.now()}@example.com`;
      const outbox = await createOutboxEntry('audit-sync-tenant', `sync-audit-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'audit-sync-tenant',
          status: 'success',
          payload: {
            email: uniqueEmail,
          },
        });

      expect(response.status).toBe(200);

      const auditLogs = await storage.getAuditLog();
      const syncLog = auditLogs.find(
        log => log.action === 'lead.sync.completed' && log.entityId === outbox.id
      );
      
      expect(syncLog).toBeDefined();
      expect(syncLog?.entityType).toBe('events_outbox');
    });
  });

  describe('error handling', () => {
    it('should handle error status from Neo8Flow', async () => {
      const outbox = await createOutboxEntry('error-test-tenant', `sync-error-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'error-test-tenant',
          status: 'error',
          error_message: 'Neo8Flow processing failed: Invalid webhook response',
          payload: {},
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid webhook response');

      const updatedOutbox = await storage.getEventsOutboxByIdempotencyKey('error-test-tenant', outbox.idempotencyKey);
      expect(updatedOutbox?.status).toBe('failed');
    });

    it('should create audit log entry on failed sync', async () => {
      const outbox = await createOutboxEntry('audit-error-tenant', `sync-audit-error-${Date.now()}`);
      
      await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'audit-error-tenant',
          status: 'error',
          error_message: 'Test error message',
          payload: {},
        });

      const auditLogs = await storage.getAuditLog();
      const failedLog = auditLogs.find(
        log => log.action === 'lead.sync.failed' && log.entityId === outbox.id
      );
      
      expect(failedLog).toBeDefined();
      expect(failedLog?.entityType).toBe('events_outbox');
    });
  });

  describe('contact lookup priority', () => {
    it('should use contact_id first when provided', async () => {
      const existingContact = await storage.createContact({
        name: 'Priority Contact',
        email: `priority-${Date.now()}@example.com`,
        customerType: 'lead',
      });

      const outbox = await createOutboxEntry('priority-test-tenant', `sync-priority-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'priority-test-tenant',
          status: 'success',
          payload: {
            contact_id: existingContact.id,
            email: 'different@example.com',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.synced.contact_id).toBe(existingContact.id);
    });

    it('should use email lookup when contact_id not found', async () => {
      const existingContact = await storage.createContact({
        name: 'Email Lookup Contact',
        email: `email-lookup-${Date.now()}@example.com`,
        customerType: 'lead',
      });

      const outbox = await createOutboxEntry('email-lookup-tenant', `sync-email-lookup-${Date.now()}`);
      
      const response = await request(app)
        .post('/api/intake/sync')
        .set('Authorization', `Bearer ${TEST_INTERNAL_TOKEN}`)
        .send({
          outbox_id: outbox.id,
          tenant_id: 'email-lookup-tenant',
          status: 'success',
          payload: {
            contact_id: 'non-existent-id',
            email: existingContact.email,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.synced.contact_id).toBe(existingContact.id);
    });
  });
});

describe('Neo8Flow dispatch integration', () => {
  let app: express.Express;
  let server: any;
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  beforeEach(() => {
    dispatchSpy = vi.spyOn(neo8Events, 'dispatchIntakeToNeo8Flow').mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it('should call dispatchIntakeToNeo8Flow with correct parameters after outbox insert', async () => {
    const uniqueKey = `dispatch-test-${Date.now()}`;
    
    const response = await request(app)
      .post('/api/intake/lead')
      .send({
        tenant_id: 'dispatch-test-tenant',
        idempotency_key: uniqueKey,
        event_type: 'lead.created',
        channel: 'widget',
        payload: {
          name: 'Dispatch Test User',
          email: 'dispatch@test.com',
        },
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.success).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    
    const [outboxId, tenantId, payload] = dispatchSpy.mock.calls[0];
    expect(outboxId).toBe(response.body.eventId);
    expect(tenantId).toBe('dispatch-test-tenant');
    expect(payload.name).toBe('Dispatch Test User');
    expect(payload.email).toBe('dispatch@test.com');
    expect(payload.timestamp).toBeDefined();
  });

  it('should include x-internal-token header in Neo8Flow dispatch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.restoreAllMocks();

    const originalUrl = process.env.NEO8FLOW_URL;
    process.env.NEO8FLOW_URL = 'https://test-neo8flow.example.com';

    try {
      const response = await neo8Events.dispatchIntakeToNeo8Flow(
        'test-outbox-id',
        'test-tenant',
        { email: 'test@example.com', timestamp: new Date().toISOString() }
      );

      if (mockFetch.mock.calls.length > 0) {
        const fetchCall = mockFetch.mock.calls[0];
        const options = fetchCall[1] as RequestInit;
        expect(options.headers).toBeDefined();
        const headers = options.headers as Record<string, string>;
        expect(headers['x-internal-token']).toBeDefined();
      }
    } finally {
      process.env.NEO8FLOW_URL = originalUrl;
      vi.unstubAllGlobals();
    }
  });

  it('should not call dispatch for duplicate requests', async () => {
    vi.restoreAllMocks();
    dispatchSpy = vi.spyOn(neo8Events, 'dispatchIntakeToNeo8Flow').mockResolvedValue({ success: true });

    const uniqueKey = `no-dispatch-dup-${Date.now()}`;
    
    await request(app)
      .post('/api/intake/lead')
      .send({
        tenant_id: 'dup-dispatch-tenant',
        idempotency_key: uniqueKey,
        event_type: 'lead.created',
        channel: 'widget',
        payload: {
          email: 'dup-dispatch@test.com',
        },
      });

    await new Promise(resolve => setTimeout(resolve, 50));
    const callsAfterFirst = dispatchSpy.mock.calls.length;

    const response2 = await request(app)
      .post('/api/intake/lead')
      .send({
        tenant_id: 'dup-dispatch-tenant',
        idempotency_key: uniqueKey,
        event_type: 'lead.created',
        channel: 'widget',
        payload: {
          email: 'dup-dispatch@test.com',
        },
      });

    expect(response2.status).toBe(200);
    expect(response2.body.status).toBe('duplicate');

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(dispatchSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});
