import { describe, it, expect } from 'vitest';
import { leadIntakeEventSchema } from '../routes';

describe('leadIntakeEventSchema', () => {
  const validPayload = {
    tenant_id: 'tenant-123',
    idempotency_key: 'key-abc-123',
    event_type: 'lead.created' as const,
    channel: 'widget' as const,
    payload: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    },
  };

  describe('required fields', () => {
    it('should accept valid payload with all required fields', () => {
      const result = leadIntakeEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject missing tenant_id', () => {
      const { tenant_id, ...payload } = validPayload;
      const result = leadIntakeEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.tenant_id).toBeDefined();
      }
    });

    it('should reject empty tenant_id', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, tenant_id: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.tenant_id).toBeDefined();
      }
    });

    it('should reject missing idempotency_key', () => {
      const { idempotency_key, ...payload } = validPayload;
      const result = leadIntakeEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.idempotency_key).toBeDefined();
      }
    });

    it('should reject empty idempotency_key', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, idempotency_key: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.idempotency_key).toBeDefined();
      }
    });

    it('should reject missing event_type', () => {
      const { event_type, ...payload } = validPayload;
      const result = leadIntakeEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid event_type', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, event_type: 'invalid.type' });
      expect(result.success).toBe(false);
    });

    it('should reject missing channel', () => {
      const { channel, ...payload } = validPayload;
      const result = leadIntakeEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing payload object', () => {
      const { payload, ...rest } = validPayload;
      const result = leadIntakeEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('channel enum validation', () => {
    const validChannels = ['widget', 'voice', 'web_form', 'api', 'import'];

    validChannels.forEach((channel) => {
      it(`should accept valid channel: ${channel}`, () => {
        const result = leadIntakeEventSchema.safeParse({ ...validPayload, channel });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid channel', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, channel: 'invalid_channel' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.channel).toBeDefined();
      }
    });
  });

  describe('event_type literal validation', () => {
    it('should accept lead.created event_type', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, event_type: 'lead.created' });
      expect(result.success).toBe(true);
    });

    it('should reject other event_types', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, event_type: 'lead.updated' });
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields with defaults', () => {
    it('should default schema_version to 1.0', () => {
      const result = leadIntakeEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema_version).toBe('1.0');
      }
    });

    it('should accept custom schema_version', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, schema_version: '2.0' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema_version).toBe('2.0');
      }
    });

    it('should accept optional source_id', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, source_id: 'form-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source_id).toBe('form-123');
      }
    });

    it('should accept optional source_ip', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, source_ip: '192.168.1.1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source_ip).toBe('192.168.1.1');
      }
    });

    it('should accept optional recording_url', () => {
      const result = leadIntakeEventSchema.safeParse({ 
        ...validPayload, 
        recording_url: 'https://storage.example.com/recordings/abc123.mp3' 
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recording_url).toBe('https://storage.example.com/recordings/abc123.mp3');
      }
    });

    it('should accept optional lead_score', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, lead_score: 75 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lead_score).toBe(75);
      }
    });

    it('should reject lead_score outside 0-100 range', () => {
      const resultNegative = leadIntakeEventSchema.safeParse({ ...validPayload, lead_score: -5 });
      expect(resultNegative.success).toBe(false);
      
      const resultOver = leadIntakeEventSchema.safeParse({ ...validPayload, lead_score: 150 });
      expect(resultOver.success).toBe(false);
    });
  });

  describe('payload object validation', () => {
    it('should accept empty payload object', () => {
      const result = leadIntakeEventSchema.safeParse({ ...validPayload, payload: {} });
      expect(result.success).toBe(true);
    });

    it('should accept payload with name', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { name: 'Jane Doe' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload.name).toBe('Jane Doe');
      }
    });

    it('should accept valid email', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { email: 'test@example.com' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty string as email (allows empty submissions)', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { email: '' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { email: 'not-an-email' },
      });
      expect(result.success).toBe(false);
    });

    it('should accept phone number', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { phone: '+1-555-555-5555' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept company name', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { company: 'Acme Corp' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept message', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { message: 'I need help with my HVAC system' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept source', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { source: 'google_ads' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept tags array', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { tags: ['hvac', 'residential', 'urgent'] },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload.tags).toEqual(['hvac', 'residential', 'urgent']);
      }
    });

    it('should accept empty tags array', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { tags: [] },
      });
      expect(result.success).toBe(true);
    });

    it('should accept custom_fields object', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: {
          custom_fields: {
            preferredTime: 'morning',
            budgetRange: '$1000-$2000',
            propertyType: 'commercial',
          },
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload.custom_fields).toEqual({
          preferredTime: 'morning',
          budgetRange: '$1000-$2000',
          propertyType: 'commercial',
        });
      }
    });

    it('should accept contact_id for existing contact reference', () => {
      const result = leadIntakeEventSchema.safeParse({
        ...validPayload,
        payload: { contact_id: 'contact-uuid-123' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload.contact_id).toBe('contact-uuid-123');
      }
    });
  });

  describe('full payload validation', () => {
    it('should accept complete payload with all fields', () => {
      const fullPayload = {
        tenant_id: 'tenant-456',
        idempotency_key: 'uuid-xyz-789',
        schema_version: '1.0',
        event_type: 'lead.created' as const,
        channel: 'web_form' as const,
        source_id: 'contact-form-home',
        source_ip: '203.0.113.45',
        recording_url: 'https://storage.example.com/recordings/abc.mp3',
        lead_score: 85,
        payload: {
          name: 'Alice Smith',
          email: 'alice@company.com',
          phone: '+1-800-555-0199',
          company: 'Smith Industries',
          message: 'Looking for quarterly maintenance contract',
          source: 'website_organic',
          tags: ['commercial', 'maintenance', 'priority'],
          custom_fields: {
            numLocations: 5,
            currentProvider: 'Other HVAC Co',
          },
          contact_id: 'existing-contact-id',
        },
      };

      const result = leadIntakeEventSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tenant_id).toBe('tenant-456');
        expect(result.data.idempotency_key).toBe('uuid-xyz-789');
        expect(result.data.schema_version).toBe('1.0');
        expect(result.data.event_type).toBe('lead.created');
        expect(result.data.channel).toBe('web_form');
        expect(result.data.recording_url).toBe('https://storage.example.com/recordings/abc.mp3');
        expect(result.data.lead_score).toBe(85);
        expect(result.data.payload.name).toBe('Alice Smith');
        expect(result.data.payload.contact_id).toBe('existing-contact-id');
      }
    });
  });
});
