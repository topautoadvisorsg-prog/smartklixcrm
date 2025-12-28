import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

describe('/api/intake/lead endpoint', () => {
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

  const validPayload = {
    tenant_id: 'test-tenant-integration',
    idempotency_key: `test-key-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    event_type: 'lead.created',
    channel: 'widget',
    payload: {
      name: 'Integration Test User',
      email: 'integration@test.com',
      phone: '+1234567890',
      message: 'Test lead from integration tests',
    },
  };

  describe('successful submissions with database verification', () => {
    it('should create events_outbox row for valid new lead', async () => {
      const uniqueKey = `db-verify-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const uniquePayload = {
        ...validPayload,
        tenant_id: 'db-test-tenant',
        idempotency_key: uniqueKey,
      };

      const response = await request(app)
        .post('/api/intake/lead')
        .send(uniquePayload)
        .expect('Content-Type', /json/);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBeDefined();

      const eventId = response.body.eventId;
      const outboxEntry = await storage.getEventsOutboxByIdempotencyKey('db-test-tenant', uniqueKey);
      
      expect(outboxEntry).toBeDefined();
      expect(outboxEntry!.id).toBe(eventId);
      expect(outboxEntry!.tenantId).toBe('db-test-tenant');
      expect(outboxEntry!.idempotencyKey).toBe(uniqueKey);
      expect(outboxEntry!.eventType).toBe('lead.created');
      expect(outboxEntry!.channel).toBe('widget');
      expect(outboxEntry!.status).toBe('pending');
      expect(outboxEntry!.schemaVersion).toBe('1.0');
    });

    it('should inject server-generated timestamp into payload', async () => {
      const uniqueKey = `timestamp-verify-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const uniquePayload = {
        ...validPayload,
        tenant_id: 'timestamp-test-tenant',
        idempotency_key: uniqueKey,
      };

      const beforeTime = new Date().toISOString();
      const response = await request(app)
        .post('/api/intake/lead')
        .send(uniquePayload);

      expect([200, 201]).toContain(response.status);
      
      const outboxEntry = await storage.getEventsOutboxByIdempotencyKey('timestamp-test-tenant', uniqueKey);
      expect(outboxEntry).toBeDefined();
      
      const payload = outboxEntry!.payload as Record<string, unknown>;
      expect(payload.timestamp).toBeDefined();
      expect(typeof payload.timestamp).toBe('string');
      
      const timestamp = new Date(payload.timestamp as string);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
    });

    it('should create audit log entry for valid new lead', async () => {
      const uniqueKey = `audit-verify-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const uniquePayload = {
        ...validPayload,
        tenant_id: 'audit-test-tenant',
        idempotency_key: uniqueKey,
      };

      const auditLogBefore = await storage.getAuditLog();
      const auditCountBefore = auditLogBefore.filter(
        log => log.action === 'lead.intake.received'
      ).length;

      const response = await request(app)
        .post('/api/intake/lead')
        .send(uniquePayload);

      expect([200, 201]).toContain(response.status);
      const eventId = response.body.eventId;

      const auditLogAfter = await storage.getAuditLog();
      const relevantLogs = auditLogAfter.filter(
        log => log.action === 'lead.intake.received' && log.entityId === eventId
      );

      expect(relevantLogs.length).toBeGreaterThan(0);
      const auditEntry = relevantLogs[0];
      expect(auditEntry.entityType).toBe('events_outbox');
      expect(auditEntry.entityId).toBe(eventId);
      expect(auditEntry.details).toBeDefined();
      const details = auditEntry.details as Record<string, unknown>;
      expect(details.tenant_id).toBe('audit-test-tenant');
      expect(details.channel).toBe('widget');
      expect(details.event_type).toBe('lead.created');
    });

    it('should return 201 for valid new lead', async () => {
      const uniquePayload = {
        ...validPayload,
        idempotency_key: `new-lead-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      const response = await request(app)
        .post('/api/intake/lead')
        .send(uniquePayload)
        .expect('Content-Type', /json/);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBeDefined();
    });
  });

  describe('duplicate detection and exact response format', () => {
    it('should return exact duplicate response format: { status, outbox_id, message }', async () => {
      const uniqueKey = `duplicate-format-${Date.now()}`;
      const payload = {
        ...validPayload,
        tenant_id: 'duplicate-format-tenant',
        idempotency_key: uniqueKey,
      };

      const response1 = await request(app)
        .post('/api/intake/lead')
        .send(payload);

      expect([200, 201]).toContain(response1.status);
      const firstEventId = response1.body.eventId;

      const response2 = await request(app)
        .post('/api/intake/lead')
        .send(payload);

      expect(response2.status).toBe(200);
      expect(response2.body.status).toBe('duplicate');
      expect(response2.body.outbox_id).toBe(firstEventId);
      expect(response2.body.message).toBe('Existing lead');
    });

    it('should reuse same DB row for duplicate idempotency_key (idempotent)', async () => {
      const uniqueKey = `idempotent-db-${Date.now()}`;
      const payload = {
        ...validPayload,
        tenant_id: 'idempotent-tenant',
        idempotency_key: uniqueKey,
      };

      const response1 = await request(app)
        .post('/api/intake/lead')
        .send(payload);

      expect([200, 201]).toContain(response1.status);
      const firstEventId = response1.body.eventId;

      const outboxEntry1 = await storage.getEventsOutboxByIdempotencyKey('idempotent-tenant', uniqueKey);
      expect(outboxEntry1).toBeDefined();
      expect(outboxEntry1!.id).toBe(firstEventId);

      const response2 = await request(app)
        .post('/api/intake/lead')
        .send(payload);

      expect(response2.status).toBe(200);
      expect(response2.body.outbox_id).toBe(firstEventId);

      const outboxEntry2 = await storage.getEventsOutboxByIdempotencyKey('idempotent-tenant', uniqueKey);
      expect(outboxEntry2).toBeDefined();
      expect(outboxEntry2!.id).toBe(firstEventId);
    });
  });

  describe('identifier validation', () => {
    it('should reject request with no identifiers (no email, phone, contact_id, or recording_url)', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          tenant_id: 'test-tenant',
          idempotency_key: `no-identifier-${Date.now()}`,
          event_type: 'lead.created',
          channel: 'api',
          payload: {
            name: 'No Identifier User',
            message: 'This should fail',
          },
        })
        .expect(400);

      expect(response.body.error).toBe('At least one identifier required');
      expect(response.body.message).toContain('email');
      expect(response.body.message).toContain('phone');
      expect(response.body.message).toContain('contact_id');
      expect(response.body.message).toContain('recording_url');
    });

    it('should accept request with only email identifier', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          tenant_id: 'test-tenant',
          idempotency_key: `email-only-${Date.now()}`,
          event_type: 'lead.created',
          channel: 'api',
          payload: {
            email: 'email-only@test.com',
          },
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('should accept request with only phone identifier', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          tenant_id: 'test-tenant',
          idempotency_key: `phone-only-${Date.now()}`,
          event_type: 'lead.created',
          channel: 'api',
          payload: {
            phone: '+15551234567',
          },
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('should accept request with only contact_id identifier', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          tenant_id: 'test-tenant',
          idempotency_key: `contact-id-only-${Date.now()}`,
          event_type: 'lead.created',
          channel: 'api',
          payload: {
            contact_id: 'existing-contact-uuid',
          },
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('should accept request with only recording_url identifier', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          tenant_id: 'test-tenant',
          idempotency_key: `recording-only-${Date.now()}`,
          event_type: 'lead.created',
          channel: 'voice',
          recording_url: 'https://storage.example.com/recordings/call123.mp3',
          payload: {
            message: 'Call recording only',
          },
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });

    it('should reject empty email string as identifier (not sufficient)', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          tenant_id: 'test-tenant',
          idempotency_key: `empty-email-only-${Date.now()}`,
          event_type: 'lead.created',
          channel: 'api',
          payload: {
            email: '',
            name: 'Empty email user',
          },
        })
        .expect(400);

      expect(response.body.error).toBe('At least one identifier required');
    });
  });

  describe('validation errors', () => {
    it('should return 400 for missing tenant_id', async () => {
      const { tenant_id, ...payload } = validPayload;
      const modifiedPayload = { ...payload, idempotency_key: `missing-tenant-${Date.now()}` };

      const response = await request(app)
        .post('/api/intake/lead')
        .send(modifiedPayload)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.tenant_id).toBeDefined();
    });

    it('should return 400 for empty tenant_id', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          tenant_id: '',
          idempotency_key: `empty-tenant-${Date.now()}`,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing idempotency_key', async () => {
      const { idempotency_key, ...payload } = validPayload;

      const response = await request(app)
        .post('/api/intake/lead')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.idempotency_key).toBeDefined();
    });

    it('should return 400 for invalid channel', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          channel: 'invalid_channel',
          idempotency_key: `invalid-channel-${Date.now()}`,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.channel).toBeDefined();
    });

    it('should return 400 for invalid event_type', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          event_type: 'lead.updated',
          idempotency_key: `invalid-event-${Date.now()}`,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid email in payload', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          idempotency_key: `invalid-email-${Date.now()}`,
          payload: {
            ...validPayload.payload,
            email: 'not-an-email',
          },
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing payload object', async () => {
      const { payload, ...rest } = validPayload;

      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...rest,
          idempotency_key: `missing-payload-${Date.now()}`,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('all valid channels', () => {
    const channels = ['widget', 'voice', 'web_form', 'api', 'import'];

    channels.forEach((channel) => {
      it(`should accept channel: ${channel}`, async () => {
        const response = await request(app)
          .post('/api/intake/lead')
          .send({
            ...validPayload,
            channel,
            idempotency_key: `channel-${channel}-${Date.now()}`,
          });

        expect([200, 201]).toContain(response.status);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('payload variations', () => {
    it('should accept payload with tags array', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          idempotency_key: `tags-${Date.now()}`,
          payload: {
            ...validPayload.payload,
            tags: ['urgent', 'hvac', 'commercial'],
          },
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should accept payload with custom_fields', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          idempotency_key: `custom-${Date.now()}`,
          payload: {
            ...validPayload.payload,
            custom_fields: {
              preferredTime: 'morning',
              budgetRange: '$500-$1000',
            },
          },
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should accept empty email string with phone as identifier', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          idempotency_key: `empty-email-${Date.now()}`,
          payload: {
            name: 'No Email User',
            email: '',
            phone: '+1234567890',
          },
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should accept lead_score field', async () => {
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          idempotency_key: `lead-score-${Date.now()}`,
          lead_score: 85,
        });

      expect([200, 201]).toContain(response.status);
      
      const outboxEntry = await storage.getEventsOutboxByIdempotencyKey(
        validPayload.tenant_id, 
        `lead-score-${Date.now()}`.slice(0, -1) + response.body.eventId.slice(-1)
      );
    });

    it('should accept recording_url field', async () => {
      const uniqueKey = `recording-url-${Date.now()}`;
      const response = await request(app)
        .post('/api/intake/lead')
        .send({
          ...validPayload,
          idempotency_key: uniqueKey,
          recording_url: 'https://storage.example.com/recordings/test.mp3',
        });

      expect([200, 201]).toContain(response.status);
      
      const outboxEntry = await storage.getEventsOutboxByIdempotencyKey(
        validPayload.tenant_id, 
        uniqueKey
      );
      expect(outboxEntry).toBeDefined();
      expect(outboxEntry!.recordingUrl).toBe('https://storage.example.com/recordings/test.mp3');
    });
  });
});
