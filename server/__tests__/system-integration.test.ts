/**
 * System Integration Tests
 * 
 * Tests core system components that don't require external platforms:
 * - Storage layer (MemStorage)
 * - Correlation ID generation
 * - Ledger entry creation
 * - Event outbox queuing
 * - Proposal system workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../storage';
import crypto from 'crypto';

describe('System Integration - Storage Layer', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('Contacts', () => {
    it('should create and retrieve a contact', async () => {
      const contact = await storage.createContact({
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
      });

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe("John Doe");
      expect(contact.email).toBe("john@example.com");
      expect(contact.createdAt).toBeDefined();

      const retrieved = await storage.getContact(contact.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(contact.id);
    });

    it('should update a contact', async () => {
      const contact = await storage.createContact({
        name: "John",
        email: "john@example.com",
      });

      const updated = await storage.updateContact(contact.id, {
        company: "Acme Corp",
      });

      expect(updated).toBeDefined();
      expect(updated?.company).toBe("Acme Corp");
    });

    it('should list contacts', async () => {
      await storage.createContact({ name: "John Doe", email: "john@example.com" });
      await storage.createContact({ name: "Jane Doe", email: "jane@example.com" });

      const contacts = await storage.getContacts();
      expect(contacts.length).toBeGreaterThanOrEqual(2);
    });

    it('should search contacts by email', async () => {
      await storage.createContact({ name: "John Doe", email: "john.search@example.com" });

      const contact = await storage.getContactByEmail("john.search@example.com");
      expect(contact).toBeDefined();
      expect(contact?.name).toBe("John Doe");
    });
  });

  describe('Jobs', () => {
    it('should create and retrieve a job', async () => {
      const job = await storage.createJob({
        title: "Test Job",
        status: "lead_intake",
        contactId: "contact-123",
      });

      expect(job.id).toBeDefined();
      expect(job.title).toBe("Test Job");
      expect(job.status).toBe("lead_intake");

      const retrieved = await storage.getJob(job.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
    });

    it('should update job status', async () => {
      const job = await storage.createJob({
        title: "Test Job",
        status: "lead_intake",
      });

      const updated = await storage.updateJob(job.id, {
        status: "scheduled",
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe("scheduled");
    });
  });

  describe('Automation Ledger', () => {
    it('should create a ledger entry', async () => {
      const entry = await storage.createAutomationLedgerEntry({
        agentName: "test_agent",
        actionType: "TEST_ACTION",
        entityType: "contacts",
        entityId: "contact-123",
        mode: "test",
        status: "completed",
      });

      expect(entry.id).toBeDefined();
      expect(entry.agentName).toBe("test_agent");
      expect(entry.actionType).toBe("TEST_ACTION");
      expect(entry.timestamp).toBeDefined();
    });

    it('should create ledger entry with correlation ID', async () => {
      const correlationId = crypto.randomUUID();

      const entry = await storage.createAutomationLedgerEntry({
        agentName: "test_agent",
        actionType: "PROPOSAL_CREATED",
        entityType: "staged_proposals",
        entityId: "proposal-123",
        mode: "ai",
        status: "pending",
        correlationId,
      });

      expect(entry.correlationId).toBe(correlationId);
    });

    it('should create multiple ledger entries with idempotency', async () => {
      const idempotencyKey = `test-${Date.now()}`;

      const entry1 = await storage.createAutomationLedgerEntry({
        agentName: "test_agent",
        actionType: "TEST_ACTION",
        entityType: "contacts",
        entityId: "contact-123",
        mode: "test",
        status: "completed",
        idempotencyKey,
      });

      // Note: MemStorage doesn't enforce idempotency, but PostgresStorage does
      const entry2 = await storage.createAutomationLedgerEntry({
        agentName: "test_agent",
        actionType: "TEST_ACTION",
        entityType: "contacts",
        entityId: "contact-123",
        mode: "test",
        status: "completed",
        idempotencyKey,
      });

      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();
    });
  });

  describe('Events Outbox', () => {
    it('should create an outbox entry', async () => {
      const entry = await storage.createEventsOutbox({
        tenantId: "tenant-123",
        idempotencyKey: "event-123",
        eventType: "proposal.execute",
        channel: "crm",
        payload: {
          proposalId: "proposal-456",
          summary: "Test proposal",
        },
        status: "pending",
      });

      expect(entry.id).toBeDefined();
      expect(entry.eventType).toBe("proposal.execute");
      expect(entry.status).toBe("pending");
      expect(entry.retryCount).toBe(0);
    });

    it('should create outbox entry with correlation ID', async () => {
      const correlationId = crypto.randomUUID();

      const entry = await storage.createEventsOutbox({
        tenantId: "tenant-123",
        idempotencyKey: "event-123",
        eventType: "email.send",
        channel: "crm",
        payload: {
          to: "test@example.com",
          correlationId,
        },
        status: "pending",
      });

      expect((entry.payload as any).correlationId).toBe(correlationId);
    });

    it('should get pending outbox events', async () => {
      await storage.createEventsOutbox({
        tenantId: "tenant-123",
        idempotencyKey: "event-1",
        eventType: "proposal.execute",
        channel: "crm",
        payload: { test: true },
        status: "pending",
      });

      await storage.createEventsOutbox({
        tenantId: "tenant-123",
        idempotencyKey: "event-2",
        eventType: "email.send",
        channel: "crm",
        payload: { test: true },
        status: "pending",
      });

      const pending = await storage.getPendingEventsOutbox(10);
      expect(pending.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Staged Proposals', () => {
    it('should create a staged proposal', async () => {
      const proposal = await storage.createStagedProposal({
        summary: "Update contact email",
        reasoning: "User requested email change",
        actions: [
          { tool: "update_contact", args: { email: "new@example.com" } }
        ],
        status: "pending",
        relatedEntity: { type: "contact", id: "contact-123" },
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.summary).toBe("Update contact email");
      expect(proposal.status).toBe("pending");
      expect(proposal.actions.length).toBe(1);
    });

    it('should create proposal with correlation ID', async () => {
      const correlationId = crypto.randomUUID();

      const proposal = await storage.createStagedProposal({
        summary: "Send follow-up email",
        reasoning: "Automated follow-up",
        actions: [],
        status: "pending",
        relatedEntity: { type: "contact", id: "contact-123" },
        correlationId,
      });

      expect(proposal.correlationId).toBe(correlationId);
    });

    it('should update proposal status', async () => {
      const proposal = await storage.createStagedProposal({
        summary: "Test proposal",
        reasoning: "Test",
        actions: [],
        status: "pending",
        relatedEntity: { type: "contact", id: "contact-123" },
      });

      const updated = await storage.updateStagedProposal(proposal.id, {
        status: "approved",
        approvedBy: "user-456",
        approvedAt: new Date(),
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe("approved");
      expect(updated?.approvedBy).toBe("user-456");
    });
  });
});

describe('System Integration - Correlation Spine', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('should propagate correlation ID through proposal → ledger → outbox', async () => {
    const correlationId = crypto.randomUUID();

    // 1. Create proposal with correlation ID
    const proposal = await storage.createStagedProposal({
      summary: "Send follow-up",
      reasoning: "Automated",
      actions: [],
      status: "pending",
      relatedEntity: { type: "contact", id: "contact-123" },
      correlationId,
    });

    expect(proposal.correlationId).toBe(correlationId);

    // 2. Create ledger entry with same correlation ID
    const ledgerEntry = await storage.createAutomationLedgerEntry({
      agentName: "ai_proposal_generator",
      actionType: "PROPOSAL_CREATED",
      entityType: "staged_proposals",
      entityId: proposal.id,
      mode: "ai",
      status: "pending",
      correlationId,
    });

    expect(ledgerEntry.correlationId).toBe(correlationId);

    // 3. Create outbox event with same correlation ID
    const outboxEntry = await storage.createEventsOutbox({
      tenantId: "tenant-123",
      idempotencyKey: `proposal-${proposal.id}`,
      eventType: "proposal.execute",
      channel: "crm",
      payload: {
        proposalId: proposal.id,
        correlationId,
      },
      status: "pending",
    });

    expect((outboxEntry.payload as any).correlationId).toBe(correlationId);

    // Verify all three share the same correlation ID
    expect(proposal.correlationId).toBe(ledgerEntry.correlationId);
    expect(ledgerEntry.correlationId).toBe((outboxEntry.payload as any).correlationId);
  });

  it('should generate unique correlation IDs for different flows', async () => {
    const correlationId1 = crypto.randomUUID();
    const correlationId2 = crypto.randomUUID();

    expect(correlationId1).not.toBe(correlationId2);
    expect(correlationId1.length).toBeGreaterThan(0);
    expect(correlationId2.length).toBeGreaterThan(0);
  });

  it('should support UUID format for correlation IDs', () => {
    const correlationId = crypto.randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(uuidRegex.test(correlationId)).toBe(true);
  });
});

describe('System Integration - Transaction Support', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('should execute transaction function', async () => {
    const result = await storage.transaction(async (tx) => {
      return "success";
    });

    expect(result).toBe("success");
  });

  it('should support async operations in transaction', async () => {
    const result = await storage.transaction(async (tx) => {
      const contact = await storage.createContact({
        firstName: "John",
        email: "john@example.com",
      });
      return contact.id;
    });

    expect(result).toBeDefined();
  });
});
