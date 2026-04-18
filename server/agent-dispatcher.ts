/**
 * Agent Event Dispatcher
 * 
 * Sends events from CRM to external agent system via webhook.
 * This is what "wakes up" the agents to execute external actions.
 * 
 * Flow: CRM Event → Dispatcher → External Agent System
 */

import { storage } from "./storage";
import type { Contact, Job, Invoice, Appointment } from "@shared/schema";

// Agent webhook URL from environment
const AGENT_WEBHOOK_URL = process.env.AGENT_WEBHOOK_URL || "http://localhost:8080/api/events";
const AGENT_WEBHOOK_SECRET = process.env.AGENT_WEBHOOK_SECRET;

// Event types that trigger agent actions
export type AgentEventType =
  | "lead_created"
  | "lead_updated"
  | "pipeline_changed"
  | "appointment_booked"
  | "appointment_cancelled"
  | "job_created"
  | "job_status_updated"
  | "invoice_created"
  | "invoice_overdue"
  | "intake_submitted"
  | "no_response_detected";

// Event payload structure
export interface AgentEvent {
  eventId: string;
  eventType: AgentEventType;
  timestamp: string;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    niche: string | null;
    status: string;
    customerType: string;
    preferredChannel: string | null;
    lastContactedAt: string | null;
    nextFollowUpAt: string | null;
    tags: string[] | null;
  };
  instruction: string;
  context: {
    job?: {
      id: string;
      title: string | null;
      status: string;
      value: string | null;
    };
    invoice?: {
      id: string;
      status: string;
      totalAmount: string | null;
      dueDate: string | null;
    };
    appointment?: {
      id: string;
      title: string | null;
      scheduledAt: string | null;
      status: string;
    };
    metadata?: Record<string, unknown>;
  };
}

// Dispatch result
export interface DispatchResult {
  success: boolean;
  eventId: string;
  error?: string;
  statusCode?: number;
}

/**
 * Build full contact record for agent event
 */
function buildContactPayload(contact: Contact): AgentEvent["contact"] {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    niche: contact.niche || null,
    status: contact.status,
    customerType: contact.customerType,
    preferredChannel: contact.preferredChannel || "email",
    lastContactedAt: contact.lastContactedAt?.toISOString() || null,
    nextFollowUpAt: contact.nextFollowUpAt?.toISOString() || null,
    tags: contact.tags || null,
  };
}

/**
 * Dispatch event to external agent system
 */
export async function dispatchAgentEvent(
  eventType: AgentEventType,
  contactId: string,
  instruction: string,
  context: AgentEvent["context"] = {}
): Promise<DispatchResult> {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Fetch full contact record
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return {
        success: false,
        eventId,
        error: `Contact ${contactId} not found`,
      };
    }

    // Build event payload
    const event: AgentEvent = {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      contact: buildContactPayload(contact),
      instruction,
      context,
    };

    // Log outbound event to audit trail
    await storage.createAuditLogEntry({
      userId: null,
      action: "agent_event_dispatched",
      entityType: "contact",
      entityId: contactId,
      details: {
        eventId,
        eventType,
        instruction,
        webhookUrl: AGENT_WEBHOOK_URL,
      },
    });

    // Send webhook (if URL configured)
    if (!AGENT_WEBHOOK_URL || AGENT_WEBHOOK_URL.includes("placeholder")) {
      console.log(`[Agent Dispatch] Webhook not configured. Event logged: ${eventId}`);
      return {
        success: true,
        eventId,
      };
    }

    // Send HTTP POST to agent system
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (AGENT_WEBHOOK_SECRET) {
      headers["X-Webhook-Secret"] = AGENT_WEBHOOK_SECRET;
    }

    const response = await fetch(AGENT_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Agent Dispatch] Failed: ${response.status} ${errorText}`);

      // Log failure
      await storage.createAuditLogEntry({
        userId: null,
        action: "agent_event_failed",
        entityType: "contact",
        entityId: contactId,
        details: {
          eventId,
          eventType,
          statusCode: response.status,
          error: errorText,
        },
      });

      return {
        success: false,
        eventId,
        error: errorText,
        statusCode: response.status,
      };
    }

    console.log(`[Agent Dispatch] Success: ${eventId} (${eventType})`);
    return {
      success: true,
      eventId,
    };
  } catch (error) {
    console.error(`[Agent Dispatch] Error:`, error);

    // Log error
    await storage.createAuditLogEntry({
      userId: null,
      action: "agent_event_error",
      entityType: "contact",
      entityId: contactId,
      details: {
        eventId,
        eventType,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      eventId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Convenience: Dispatch lead created event
 */
export async function dispatchLeadCreated(contactId: string): Promise<DispatchResult> {
  return dispatchAgentEvent(
    "lead_created",
    contactId,
    "New lead created. Initiate welcome sequence and qualify the lead."
  );
}

/**
 * Convenience: Dispatch pipeline changed event
 */
export async function dispatchPipelineChanged(
  contactId: string,
  oldStage: string,
  newStage: string
): Promise<DispatchResult> {
  return dispatchAgentEvent(
    "pipeline_changed",
    contactId,
    `Contact moved from "${oldStage}" to "${newStage}". Execute stage-specific follow-up.`,
    {
      metadata: { oldStage, newStage },
    }
  );
}

/**
 * Convenience: Dispatch job status updated event
 */
export async function dispatchJobStatusUpdated(
  contactId: string,
  job: Job
): Promise<DispatchResult> {
  return dispatchAgentEvent(
    "job_status_updated",
    contactId,
    `Job status changed to "${job.status}". Notify relevant parties and update timeline.`,
    {
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        value: job.value,
      },
    }
  );
}

/**
 * Convenience: Dispatch invoice overdue event
 */
export async function dispatchInvoiceOverdue(
  contactId: string,
  invoice: Invoice
): Promise<DispatchResult> {
  return dispatchAgentEvent(
    "invoice_overdue",
    contactId,
    `Invoice ${invoice.id} is overdue. Send payment reminder and follow up.`,
    {
      invoice: {
        id: invoice.id,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        dueDate: invoice.dueDate?.toISOString() || null,
      },
    }
  );
}

/**
 * Convenience: Dispatch appointment booked event
 */
export async function dispatchAppointmentBooked(
  contactId: string,
  appointment: Appointment
): Promise<DispatchResult> {
  return dispatchAgentEvent(
    "appointment_booked",
    contactId,
    `Appointment booked for ${appointment.scheduledAt}. Send confirmation and reminders.`,
    {
      appointment: {
        id: appointment.id,
        title: appointment.title,
        scheduledAt: appointment.scheduledAt?.toISOString() || null,
        status: appointment.status,
      },
    }
  );
}
