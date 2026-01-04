import { z } from "zod";
import { storage } from "./storage";
import { 
  acceptEstimate, 
  rejectEstimate,
  sendEstimate,
  startJob, 
  completeJob,
  sendInvoice,
  recordPayment,
  assignTechnician,
  updateJobStatus
} from "./pipeline";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  isMutationTool,
  createLedgerEntry,
  markLedgerSuccess,
  markLedgerFailed,
  createDiff,
  updateDiff,
  sendDiff,
  type LedgerDiff,
} from "./automation-ledger";

// Extended tool type with tier classification for gating control
// Why: Tools are gated based on their potential impact - "immediate" tools execute instantly,
// while "gated" tools require user confirmation or go through a review process
export type AIToolTier = "immediate" | "gated";

// OpenAI function tool parameter definition
interface ParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: {
    type: string;
    description?: string;
    properties?: Record<string, ParameterProperty>;
    required?: string[];
    items?: {
      type: string;
      description?: string;
    };
  };
}

interface FunctionParameters {
  type: "object";
  properties: Record<string, ParameterProperty>;
  required?: string[];
}

// AI tool definition that matches OpenAI's ChatCompletionTool structure
// with additional tier property for our gating system
export interface AIToolDefinition {
  type: "function";
  tier: AIToolTier;
  readonly?: boolean; // Read-only tools execute immediately, never go to review queue
  function: {
    name: string;
    description: string;
    parameters: FunctionParameters;
  };
}

// Read-only tools that should ALWAYS execute immediately (no review queue)
export const READ_ONLY_TOOLS = new Set([
  "search_contacts",
  "get_contact_details", 
  "search_pricebook",
  "search_jobs",
  "get_invoice",
  "get_estimate",
  "get_crm_stats",
  "query_automation_ledger",
  "query_review_queue",
  "query_ready_execution",
  "resolve_document", // Internal lookup for document artifacts
]);

// Check if a tool is read-only (safe to execute immediately)
export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.has(toolName);
}

// Helper to convert AIToolDefinition to ChatCompletionTool (strips tier property)
// Why: We use our own AIToolDefinition for internal tier classification, but OpenAI API
// expects ChatCompletionTool format. This strips our custom 'tier' field.
export function toOpenAITools(tools: AIToolDefinition[]): ChatCompletionTool[] {
  return tools.map(({ tier, ...rest }) => rest as unknown as ChatCompletionTool);
}

export const aiToolDefinitions: AIToolDefinition[] = [
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "create_contact",
      description: "Create a new contact/customer in the CRM. Use this when someone mentions a new customer or you need to add contact information. ALWAYS search for existing contacts first to avoid duplicates.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The full name of the contact"
          },
          email: {
            type: "string",
            description: "Email address of the contact"
          },
          phone: {
            type: "string",
            description: "Phone number of the contact"
          },
          company: {
            type: "string",
            description: "Company name if applicable"
          },
          status: {
            type: "string",
            enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
            description: "Current lead status. Defaults to 'new'."
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "update_contact",
      description: "Update an existing contact's information. Use this to modify contact details like phone, email, company, or status.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The ID of the contact to update"
          },
          name: {
            type: "string",
            description: "Updated full name"
          },
          email: {
            type: "string",
            description: "Updated email address"
          },
          phone: {
            type: "string",
            description: "Updated phone number"
          },
          company: {
            type: "string",
            description: "Updated company name"
          },
          status: {
            type: "string",
            enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
            description: "Updated lead status"
          }
        },
        required: ["contactId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "search_contacts",
      description: "READ-ONLY: Search or list CONTACT records. Returns Contact[] with fields: id, name, email, phone, company, status. If query is empty or omitted, returns ALL contacts. Use this for 'give me their names' follow-ups.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional search query (name, phone, or email). Omit or pass empty string to get ALL contacts."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "get_contact_details",
      description: "READ-ONLY: Get full CONTACT record by ID including related jobs, estimates, and invoices. Returns a single Contact object with all fields. Use this when you have a contact ID from a previous search. Safe for context anchoring.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The ID of the contact to retrieve"
          }
        },
        required: ["contactId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "create_job",
      description: "Create a new job for a contact. Use this when work needs to be scheduled or tracked.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The ID of the contact this job is for"
          },
          title: {
            type: "string",
            description: "Job title or summary"
          },
          description: {
            type: "string",
            description: "Detailed description of the work to be done"
          },
          status: {
            type: "string",
            enum: ["lead_intake", "estimate_sent", "scheduled", "in_progress", "completed", "cancelled", "invoiced", "paid"],
            description: "Initial job status. Defaults to 'lead_intake'."
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Job priority level. Defaults to 'medium'."
          }
        },
        required: ["contactId", "title", "description"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "update_job",
      description: "Update a job's details. Use this to modify job title, description, value, deadline, job type, or scheduling. Does NOT change status - use update_job_status for that.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job to update"
          },
          title: {
            type: "string",
            description: "Updated job title"
          },
          description: {
            type: "string",
            description: "Updated job description"
          },
          value: {
            type: "string",
            description: "Updated job value as decimal string (e.g., '5000.00')"
          },
          deadline: {
            type: "string",
            description: "Updated deadline as ISO datetime string (e.g., '2025-12-31T23:59:59Z')"
          },
          scheduledStart: {
            type: "string",
            description: "Updated scheduled start time as ISO datetime string"
          },
          scheduledEnd: {
            type: "string",
            description: "Updated scheduled end time as ISO datetime string"
          },
          jobType: {
            type: "string",
            description: "Updated job type (e.g., 'lead', 'service', 'maintenance')"
          }
        },
        required: ["jobId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "add_note",
      description: "Add a note to a contact or job. Use this to record important information, call logs, or follow-up details.",
      parameters: {
        type: "object",
        properties: {
          entityType: {
            type: "string",
            enum: ["contact", "job"],
            description: "What this note is attached to"
          },
          entityId: {
            type: "string",
            description: "The ID of the contact or job"
          },
          content: {
            type: "string",
            description: "The note content"
          },
          category: {
            type: "string",
            enum: ["general", "call_log", "meeting", "follow_up", "issue", "resolution"],
            description: "Type of note. Defaults to 'general'."
          }
        },
        required: ["entityType", "entityId", "content"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "schedule_appointment",
      description: "Schedule an appointment for a job. Use this to set up service visits or meetings.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job this appointment is for"
          },
          scheduledAt: {
            type: "string",
            description: "ISO datetime string for when the appointment is scheduled (e.g., '2025-11-22T14:00:00Z')"
          },
          duration: {
            type: "number",
            description: "Duration in minutes. Defaults to 60."
          },
          notes: {
            type: "string",
            description: "Optional notes about the appointment"
          }
        },
        required: ["jobId", "scheduledAt"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "create_estimate",
      description: "Create a new estimate for a customer. Use this when a customer requests a quote or pricing for services. Line items should include description, quantity, unit price, and total.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The ID of the contact/customer this estimate is for"
          },
          jobId: {
            type: "string",
            description: "Optional: The ID of the job this estimate is linked to"
          },
          lineItems: {
            type: "array",
            description: "Array of line items for the estimate. Each should have description, quantity, unit_price, and total",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                total: { type: "number" }
              },
              required: ["description", "quantity", "unit_price", "total"]
            }
          },
          subtotal: {
            type: "string",
            description: "Subtotal amount as decimal string (e.g., '1000.00')"
          },
          taxAmount: {
            type: "string",
            description: "Tax amount as decimal string (e.g., '80.00')"
          },
          totalAmount: {
            type: "string",
            description: "Total amount as decimal string (e.g., '1080.00')"
          },
          validUntil: {
            type: "string",
            description: "ISO date string for when this estimate expires (e.g., '2025-12-31')"
          },
          notes: {
            type: "string",
            description: "Optional notes or terms for the estimate"
          }
        },
        required: ["contactId", "lineItems", "subtotal", "taxAmount", "totalAmount"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "accept_estimate",
      description: "Accept an estimate and convert it to a scheduled job. Use this when a customer approves an estimate. This will create a job if one doesn't exist, or update the existing job to 'scheduled' status.",
      parameters: {
        type: "object",
        properties: {
          estimateId: {
            type: "string",
            description: "The ID of the estimate to accept"
          }
        },
        required: ["estimateId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "reject_estimate",
      description: "Reject an estimate. Use this when a customer declines an estimate. This will cancel any linked job.",
      parameters: {
        type: "object",
        properties: {
          estimateId: {
            type: "string",
            description: "The ID of the estimate to reject"
          }
        },
        required: ["estimateId"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "send_estimate",
      description: "Send an estimate to the customer. Marks the estimate as sent and triggers email delivery. This is a GATED action that requires approval.",
      parameters: {
        type: "object",
        properties: {
          estimateId: {
            type: "string",
            description: "The ID of the estimate to mark as sent"
          }
        },
        required: ["estimateId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "create_invoice",
      description: "Create an invoice for a completed job. Use this after a job is completed to bill the customer. The invoice should reference the job and estimate if applicable.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job this invoice is for"
          },
          contactId: {
            type: "string",
            description: "The ID of the contact/customer to invoice"
          },
          estimateId: {
            type: "string",
            description: "Optional: The ID of the estimate this invoice is based on"
          },
          lineItems: {
            type: "array",
            description: "Array of line items for the invoice. Each should have description, quantity, unit_price, and total",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                total: { type: "number" }
              },
              required: ["description", "quantity", "unit_price", "total"]
            }
          },
          subtotal: {
            type: "string",
            description: "Subtotal amount as decimal string (e.g., '1000.00')"
          },
          taxAmount: {
            type: "string",
            description: "Tax amount as decimal string (e.g., '80.00')"
          },
          totalAmount: {
            type: "string",
            description: "Total amount as decimal string (e.g., '1080.00')"
          },
          dueDate: {
            type: "string",
            description: "ISO date string for when payment is due (e.g., '2025-12-31')"
          },
          notes: {
            type: "string",
            description: "Optional notes or payment terms for the invoice"
          }
        },
        required: ["jobId", "contactId", "lineItems", "subtotal", "taxAmount", "totalAmount"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "record_payment",
      description: "Record a payment received for an invoice. This will mark the invoice as paid if the total payments cover the full amount. Supports partial payments. This is a GATED action that requires approval.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: {
            type: "string",
            description: "The ID of the invoice this payment is for"
          },
          amount: {
            type: "string",
            description: "Payment amount as decimal string (e.g., '500.00'). Must be positive and not exceed outstanding balance."
          },
          method: {
            type: "string",
            description: "Payment method used (e.g., 'credit_card', 'check', 'cash', 'bank_transfer')"
          },
          transactionRef: {
            type: "string",
            description: "Optional: Transaction reference number or check number"
          }
        },
        required: ["invoiceId", "amount", "method"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "assign_technician",
      description: "Assign a technician to a job. Use this for dispatching field service work. The technician will be added to the job's assigned technicians list.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job to assign the technician to"
          },
          technicianId: {
            type: "string",
            description: "The ID of the technician user to assign"
          }
        },
        required: ["jobId", "technicianId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "update_job_status",
      description: "Update the status of a job. Use this to progress a job through its lifecycle: scheduled, in_progress, completed, cancelled. Status changes will be audited.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job to update"
          },
          status: {
            type: "string",
            enum: ["lead_intake", "estimate_sent", "scheduled", "in_progress", "completed", "cancelled", "invoiced", "paid"],
            description: "The new status for the job"
          }
        },
        required: ["jobId", "status"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "start_job",
      description: "Start a scheduled job, marking it as in progress. Use this when field work begins.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job to start"
          }
        },
        required: ["jobId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "complete_job",
      description: "Mark a job as completed. Use this when field work is finished. The job status will be set to 'completed' and a completion timestamp will be recorded.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "The ID of the job to complete"
          }
        },
        required: ["jobId"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "send_invoice",
      description: "Send an invoice to the customer. Marks the invoice as sent and triggers email delivery. This is a GATED action that requires approval.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: {
            type: "string",
            description: "The ID of the invoice to send"
          }
        },
        required: ["invoiceId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "search_pricebook",
      description: "READ-ONLY: Search PRICEBOOK entries by name, SKU, or category. Returns array of PricebookItem objects with pricing details. Use for finding service/product pricing.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for name or SKU"
          },
          category: {
            type: "string",
            enum: ["part", "labor", "service", "material"],
            description: "Filter by category"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "search_jobs",
      description: "READ-ONLY: Search for JOB records by title, status, or contact ID. Returns array of Job objects with full details. Use returned job ID for follow-up queries. Safe for context anchoring.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for job title"
          },
          status: {
            type: "string",
            enum: ["lead_intake", "estimate_sent", "scheduled", "in_progress", "completed", "cancelled", "invoiced", "paid"],
            description: "Filter by job status"
          },
          contactId: {
            type: "string",
            description: "Filter by contact ID"
          }
        }
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "get_invoice",
      description: "READ-ONLY: Get full INVOICE record by ID including line items and payment status. Returns single Invoice object. Use when you have an invoice ID from previous search.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: {
            type: "string",
            description: "The ID of the invoice to retrieve"
          }
        },
        required: ["invoiceId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "get_estimate",
      description: "READ-ONLY: Get full ESTIMATE record by ID including line items. Returns single Estimate object. Use when you have an estimate ID from previous search.",
      parameters: {
        type: "object",
        properties: {
          estimateId: {
            type: "string",
            description: "The ID of the estimate to retrieve"
          }
        },
        required: ["estimateId"]
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "get_crm_stats",
      description: "READ-ONLY: Get system-wide aggregate COUNTS only (not records). Returns: total contacts, jobs by status, estimates by status, invoices by status. Use for summary questions like 'How many contacts?' NOT for listing individual records.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "query_automation_ledger",
      description: "READ-ONLY: Query LEDGER entries (audit trail of all actions). Returns array of ledger records with action_type, status, agent_name, timestamp. Use filters to scope results. This is for READING the ledger, not writing to it.",
      parameters: {
        type: "object",
        properties: {
          actionType: {
            type: "string",
            description: "Filter by action type (e.g., 'AI_PROPOSAL_CREATED', 'AI_VALIDATION_RECORDED', 'HUMAN_EXECUTION_DECISION')"
          },
          status: {
            type: "string",
            description: "Filter by status (e.g., 'pending_review', 'ai_validated', 'executed', 'rejected')"
          },
          agentName: {
            type: "string",
            description: "Filter by agent name (e.g., 'ActionAI CRM', 'Master Architect', 'Human')"
          },
          limit: {
            type: "string",
            description: "Maximum number of entries to return (default: 20)"
          }
        }
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "query_review_queue",
      description: "READ-ONLY: Query ASSIST_QUEUE entries (AI proposals). Returns array of queue entries with status, user_request, tools_called. Use status filter to scope (pending, approved, rejected, all).",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "approved", "rejected", "all"],
            description: "Filter by status (default: 'pending')"
          },
          limit: {
            type: "string",
            description: "Maximum number of entries to return (default: 20)"
          }
        }
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "query_ready_execution",
      description: "READ-ONLY: Query ASSIST_QUEUE entries that are approved and awaiting human execution. Returns array of queue entries with status 'approved_pending_send'.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "string",
            description: "Maximum number of entries to return (default: 20)"
          }
        }
      }
    }
  },
  {
    type: "function",
    tier: "immediate",
    function: {
      name: "resolve_document",
      description: "READ-ONLY: Look up existing Google Docs by title, contact, or job. REQUIRES at least one of: title, contactId, or jobId. Use 'title' to find docs by name (e.g., 'Happy Gilmore'). Returns the documentId, title, and URL of documents. Use this BEFORE calling update_doc to get the correct documentId.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Document title to search for (case-insensitive partial match). Use this when operator mentions a doc by name."
          },
          contactId: {
            type: "string",
            description: "Contact ID to find documents for"
          },
          jobId: {
            type: "string",
            description: "Job ID to find documents for"
          },
          documentType: {
            type: "string",
            enum: ["google_doc", "google_sheet"],
            description: "Type of document to look for (default: google_doc)"
          },
          limit: {
            type: "number",
            description: "Maximum number of documents to return (default: 5)"
          }
        }
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "send_email",
      description: "Send an email to a contact. Use this to send estimates, payment links, follow-ups, or any communication. EXTERNAL tool - executed via Neo8/n8n.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The ID of the contact to email"
          },
          to: {
            type: "string",
            description: "Email address to send to (usually the contact's email)"
          },
          subject: {
            type: "string",
            description: "Email subject line"
          },
          body: {
            type: "string",
            description: "Email body content (plain text or HTML)"
          },
          estimateId: {
            type: "string",
            description: "Optional: ID of estimate to attach/reference in email"
          },
          invoiceId: {
            type: "string",
            description: "Optional: ID of invoice to attach/reference in email"
          },
          paymentLinkUrl: {
            type: "string",
            description: "Optional: Payment link URL to include in email"
          }
        },
        required: ["contactId", "to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "stripe_create_payment_link",
      description: "Create a Stripe payment link for a contact to pay online. Use this when user requests a payment link, online payment, or wants to collect payment. EXTERNAL tool - executed via Neo8/n8n → Stripe.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The ID of the contact this payment is for"
          },
          amount: {
            type: "number",
            description: "Payment amount in dollars (e.g., 425.00)"
          },
          description: {
            type: "string",
            description: "Description of what the payment is for"
          },
          customerEmail: {
            type: "string",
            description: "Email address for the customer (for Stripe receipt)"
          },
          customerName: {
            type: "string",
            description: "Customer name for the payment"
          },
          estimateId: {
            type: "string",
            description: "Optional: ID of the estimate this payment is for"
          },
          invoiceId: {
            type: "string",
            description: "Optional: ID of the invoice this payment is for"
          }
        },
        required: ["contactId", "amount", "description"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "google_docs_create",
      description: "Create a new Google Doc with a title only. Returns the documentId needed for update_doc. Use update_doc to add content after creation. EXTERNAL tool - executed via Neo8/n8n → Google Docs API.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the new Google Doc"
          },
          folderId: {
            type: "string",
            description: "Optional: Google Drive folder ID to create the doc in"
          }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "google_docs_update",
      description: "Add or update content in a Google Doc. IMPORTANT: Use resolve_document first to get the documentId if you don't have it. This handles ALL content operations. EXTERNAL tool - executed via Neo8/n8n → Google Docs API.",
      parameters: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            description: "The Google Docs document ID to update. Get this from resolve_document or a prior create_doc response."
          },
          content: {
            type: "string",
            description: "Content to add or update in the document"
          },
          mode: {
            type: "string",
            enum: ["append", "replace"],
            description: "Whether to append to existing content or replace it entirely. Defaults to 'append'."
          }
        },
        required: ["documentId", "content"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "google_sheets_create",
      description: "Create a new Google Sheet. Use for creating reports, data tracking, or spreadsheets. EXTERNAL tool - executed via Neo8/n8n → Google Sheets API. Information AI only.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the new Google Sheet"
          },
          headers: {
            type: "array",
            items: { type: "string" },
            description: "Column headers for the first row"
          },
          initialData: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "Optional: Initial rows of data (array of arrays)"
          },
          folderId: {
            type: "string",
            description: "Optional: Google Drive folder ID to create the sheet in"
          }
        },
        required: ["title", "headers"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "google_sheets_update",
      description: "Update cells or rows in an existing Google Sheet. Use for modifying data, updating reports. EXTERNAL tool - executed via Neo8/n8n → Google Sheets API. Information AI only.",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: {
            type: "string",
            description: "The Google Sheets spreadsheet ID to update"
          },
          sheetName: {
            type: "string",
            description: "Name of the sheet/tab within the spreadsheet (e.g., 'Sheet1')"
          },
          range: {
            type: "string",
            description: "Cell range to update in A1 notation (e.g., 'A1:D5', 'B2:B10')"
          },
          values: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "2D array of values to write to the range"
          }
        },
        required: ["spreadsheetId", "range", "values"]
      }
    }
  },
  {
    type: "function",
    tier: "gated",
    function: {
      name: "google_sheets_append",
      description: "Append rows to an existing Google Sheet. Use for adding new data entries to a spreadsheet. EXTERNAL tool - executed via Neo8/n8n → Google Sheets API. Information AI only.",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: {
            type: "string",
            description: "The Google Sheets spreadsheet ID to append to"
          },
          sheetName: {
            type: "string",
            description: "Name of the sheet/tab within the spreadsheet (e.g., 'Sheet1')"
          },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "Array of rows to append (each row is an array of cell values)"
          }
        },
        required: ["spreadsheetId", "rows"]
      }
    }
  }
];

// Helper function to get the tier for a tool name
export function getToolTier(toolName: string): AIToolTier | undefined {
  const tool = aiToolDefinitions.find(t => t.function.name === toolName);
  return tool?.tier;
}

// Helper to check if a tool is gated
export function isGatedTool(toolName: string): boolean {
  return getToolTier(toolName) === "gated";
}

// List of gated tool names for quick reference
export const GATED_TOOLS = ["send_invoice", "send_estimate", "record_payment"] as const;

// P1 HARDENING: Blocked tools - AI can NEVER call these (hard deletes not allowed)
// Soft-delete only enforcement - AI should archive/flag instead of delete
export const BLOCKED_TOOLS = [
  "delete_contact",
  "delete_job", 
  "delete_estimate",
  "delete_invoice",
  "delete_payment",
  "delete_appointment",
  "delete_note",
  "drop_database",
  "delete_all_contacts",
  "purge_records",
  "hard_delete",
] as const;

// Check if a tool is blocked (hard-delete operations)
export function isBlockedTool(toolName: string): boolean {
  return (BLOCKED_TOOLS as readonly string[]).includes(toolName);
}

const createContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required").optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]).optional(),
});

const updateContactSchema = z.object({
  contactId: z.string(),
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Valid email required").optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]).optional(),
});

const searchContactsSchema = z.object({
  query: z.string().optional().default(""),
});

const getContactDetailsSchema = z.object({
  contactId: z.string(),
});

const createJobSchema = z.object({
  contactId: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["lead_intake", "estimate_sent", "scheduled", "in_progress", "completed", "cancelled", "invoiced", "paid"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const updateJobSchema = z.object({
  jobId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, "Value must be a valid decimal").optional(),
  deadline: z.string().datetime().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  jobType: z.string().optional(),
});

const addNoteSchema = z.object({
  entityType: z.enum(["contact", "job"]),
  entityId: z.string(),
  content: z.string().min(1, "Note content is required"),
  category: z.enum(["general", "call_log", "meeting", "follow_up", "issue", "resolution"]).optional(),
});

const scheduleAppointmentSchema = z.object({
  jobId: z.string(),
  scheduledAt: z.string(),
  duration: z.number().positive().optional(),
  notes: z.string().optional(),
});

const createEstimateSchema = z.object({
  contactId: z.string(),
  jobId: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number({ invalid_type_error: "Quantity must be a number" }).positive("Quantity must be positive"),
    unit_price: z.coerce.number({ invalid_type_error: "Unit price must be a number" }).positive("Unit price must be positive"),
    total: z.coerce.number({ invalid_type_error: "Total must be a number" }).positive("Total must be positive"),
  })),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Subtotal must be a valid decimal (e.g., 100.00)"),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Tax amount must be a valid decimal (e.g., 8.00)"),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total amount must be a valid decimal (e.g., 108.00)"),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

const acceptEstimateSchema = z.object({
  estimateId: z.string(),
});

const rejectEstimateSchema = z.object({
  estimateId: z.string(),
});

const sendEstimateSchema = z.object({
  estimateId: z.string(),
});

const createInvoiceSchema = z.object({
  jobId: z.string(),
  contactId: z.string(),
  estimateId: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number({ invalid_type_error: "Quantity must be a number" }).positive("Quantity must be positive"),
    unit_price: z.coerce.number({ invalid_type_error: "Unit price must be a number" }).positive("Unit price must be positive"),
    total: z.coerce.number({ invalid_type_error: "Total must be a number" }).positive("Total must be positive"),
  })),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Subtotal must be a valid decimal (e.g., 100.00)"),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Tax amount must be a valid decimal (e.g., 8.00)"),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total amount must be a valid decimal (e.g., 108.00)"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const recordPaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Payment amount must be a valid decimal (e.g., 100.00)"),
  method: z.string().min(1, "Payment method is required"),
  transactionRef: z.string().optional(),
});

const assignTechnicianSchema = z.object({
  jobId: z.string(),
  technicianId: z.string(),
});

const updateJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["lead_intake", "estimate_sent", "scheduled", "in_progress", "completed", "cancelled", "invoiced", "paid"]),
});

const startJobSchema = z.object({
  jobId: z.string(),
});

const completeJobSchema = z.object({
  jobId: z.string(),
});

const sendInvoiceSchema = z.object({
  invoiceId: z.string(),
});

const searchPricebookSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  category: z.enum(["part", "labor", "service", "material"]).optional(),
});

const searchJobsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["lead_intake", "estimate_sent", "scheduled", "in_progress", "completed", "cancelled", "invoiced", "paid"]).optional(),
  contactId: z.string().optional(),
});

const getInvoiceSchema = z.object({
  invoiceId: z.string(),
});

const getEstimateSchema = z.object({
  estimateId: z.string(),
});

type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  queued?: boolean; // Indicates action was queued for approval (gated actions in semi_autonomous mode)
  queueId?: string; // The assist_queue entry ID if queued
};

export type FinalizationMode = "fully_autonomous" | "semi_autonomous";

export type ActionExecutionType = "INTERNAL" | "EXTERNAL";

export const INTERNAL_TOOLS: readonly string[] = [
  "create_contact",
  "update_contact",
  "search_contacts",
  "get_contact",
  "create_job",
  "update_job",
  "search_jobs",
  "get_job",
  "create_estimate",
  "get_estimate",
  "create_invoice",
  "get_invoice",
  "add_note",
  "get_notes",
  "get_appointments",
  "create_appointment",
  "update_appointment",
  "search_pricebook",
  "get_pipeline_summary",
  "get_dashboard_data",
  "assign_technician",
  "update_job_status",
  "get_system_help",
  "resolve_document", // Read-only lookup of documents created via CRM
] as const;

export const EXTERNAL_TOOLS: readonly string[] = [
  "send_email",
  "send_sms",
  "send_whatsapp",
  "send_estimate",
  "send_invoice",
  "record_payment",
  "start_job",
  "complete_job",
  "accept_estimate",
  "reject_estimate",
  "google_docs_create",
  "google_docs_update",
  "google_sheets_create",
  "google_sheets_update",
  "google_sheets_append",
  "google_calendar_create",
  "stripe_create_payment_link",
  "stripe_charge",
] as const;

export function classifyAction(toolName: string): ActionExecutionType {
  if (INTERNAL_TOOLS.includes(toolName)) {
    return "INTERNAL";
  }
  if (EXTERNAL_TOOLS.includes(toolName)) {
    return "EXTERNAL";
  }
  console.warn(`[ActionClassification] Unknown tool "${toolName}" - defaulting to EXTERNAL for safety`);
  return "EXTERNAL";
}

export function isInternalAction(toolName: string): boolean {
  return classifyAction(toolName) === "INTERNAL";
}

export function isExternalAction(toolName: string): boolean {
  return classifyAction(toolName) === "EXTERNAL";
}

export interface ExecuteToolOptions {
  userId?: string;
  finalizationMode?: FinalizationMode;
  assistQueueId?: string; // If executing from an approved queue item
}

export async function executeAITool(toolName: string, args: unknown, options: ExecuteToolOptions = {}): Promise<ToolResult> {
  const { userId, finalizationMode = "semi_autonomous", assistQueueId } = options;
  
  // P1 HARDENING: BLOCKED tools are absolutely forbidden (hard deletes not allowed)
  // AI should use archive/flag operations instead - this is a HARD ERROR
  if (isBlockedTool(toolName)) {
    const errorMessage = `[GOVERNANCE VIOLATION] BLOCKED action "${toolName}" cannot be executed. Hard-delete operations are forbidden. Use archive/flag operations for soft-delete instead.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // GOVERNANCE GUARDRAIL: EXTERNAL tools MUST go through Neo-8, not direct execution
  // This is a HARD ERROR - no exceptions, no bypasses
  if (isExternalAction(toolName)) {
    const errorMessage = `[GOVERNANCE VIOLATION] EXTERNAL action "${toolName}" cannot be executed directly. All external/provider actions MUST be dispatched to Neo-8. This is a non-negotiable architectural constraint.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // Check if this is a gated action that needs approval routing
  if (isGatedTool(toolName) && finalizationMode === "semi_autonomous" && !assistQueueId) {
    // Queue the gated action for human approval instead of executing
    const queueEntry = await storage.createAssistQueueEntry({
      userId: userId ?? null,
      mode: "auto",
      userRequest: `AI requested to execute gated action: ${toolName}`,
      status: "pending_approval",
      requiresApproval: true,
      gatedActionType: toolName,
      finalizationPayload: args as Record<string, unknown>,
      architectApprovedAt: new Date(), // Master Architect approved this action
    });
    
    await storage.createAuditLogEntry({
      userId: userId ?? null,
      action: "gated_action_queued",
      entityType: "assist_queue",
      entityId: queueEntry.id,
      details: { toolName, args, finalizationMode },
    });
    
    return {
      success: true,
      queued: true,
      queueId: queueEntry.id,
      data: { message: `Action '${toolName}' queued for human approval`, queueId: queueEntry.id },
    };
  }
  
  // Create ledger entry for mutations BEFORE execution
  // Why: All state-changing actions must be logged before they happen
  let ledgerEntryId: string | undefined;
  if (isMutationTool(toolName)) {
    try {
      const ledgerEntry = await createLedgerEntry({
        agentName: "master_architect",
        toolName,
        assistQueueId,
      });
      ledgerEntryId = ledgerEntry.id;
    } catch (ledgerError) {
      console.error("[AutomationLedger] Failed to create ledger entry:", ledgerError);
    }
  }
  
  try {
    switch (toolName) {
      case "create_contact": {
        const params = createContactSchema.parse(args);
        
        const contact = await storage.createContact({
          name: params.name,
          email: params.email ?? null,
          phone: params.phone ?? null,
          company: params.company ?? null,
          status: params.status ?? "new",
        });
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "create_contact",
          entityType: "contact",
          entityId: contact.id,
          details: { source: "ai_agent", ...params },
        });
        
        // Update ledger entry on success with snapshot
        if (ledgerEntryId) {
          await markLedgerSuccess({
            ledgerId: ledgerEntryId,
            entityId: contact.id,
            diffJson: createDiff(contact as unknown as Record<string, unknown>),
          });
        }
        
        return { success: true, data: contact };
      }

      case "update_contact": {
        const params = updateContactSchema.parse(args);
        
        const existing = await storage.getContact(params.contactId);
        if (!existing) {
          if (ledgerEntryId) {
            await markLedgerFailed({ ledgerId: ledgerEntryId, reason: "Contact not found" });
          }
          return { success: false, error: "Contact not found" };
        }
        
        const contact = await storage.updateContact(params.contactId, {
          name: params.name,
          email: params.email,
          phone: params.phone,
          company: params.company,
          status: params.status,
        });
        
        if (!contact) {
          if (ledgerEntryId) {
            await markLedgerFailed({ ledgerId: ledgerEntryId, reason: "Failed to update contact" });
          }
          return { success: false, error: "Failed to update contact" };
        }
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "update_contact",
          entityType: "contact",
          entityId: contact.id,
          details: { source: "ai_agent", changes: params },
        });
        
        // Update ledger entry on success with before/after diff
        if (ledgerEntryId) {
          await markLedgerSuccess({
            ledgerId: ledgerEntryId,
            entityId: contact.id,
            diffJson: updateDiff(
              existing as unknown as Record<string, unknown>,
              contact as unknown as Record<string, unknown>
            ),
          });
        }
        
        return { success: true, data: contact };
      }

      case "search_contacts": {
        const params = searchContactsSchema.parse(args);
        
        const contacts = await storage.getContacts();
        const query = (params.query || "").toLowerCase().trim();
        
        // If query is empty, return all contacts (for follow-up questions like "give me their names")
        if (!query) {
          return { success: true, data: contacts };
        }
        
        const filtered = contacts.filter(c => {
          const nameMatch = c.name?.toLowerCase().includes(query) ?? false;
          const emailMatch = c.email?.toLowerCase().includes(query) ?? false;
          const phoneMatch = c.phone?.includes(query) ?? false;
          return nameMatch || emailMatch || phoneMatch;
        });
        
        return { success: true, data: filtered };
      }

      case "get_contact_details": {
        const params = getContactDetailsSchema.parse(args);
        
        const contact = await storage.getContact(params.contactId);
        if (!contact) {
          return { success: false, error: "Contact not found" };
        }
        
        const [jobs, estimates, invoices] = await Promise.all([
          storage.getJobs(),
          storage.getEstimates(),
          storage.getInvoices(),
        ]);
        
        const contactJobs = jobs.filter(j => j.clientId === params.contactId);
        const contactEstimates = estimates.filter(e => e.contactId === params.contactId);
        const contactInvoices = invoices.filter(i => i.contactId === params.contactId);
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "get_contact_details",
          entityType: "contact",
          entityId: params.contactId,
          details: { source: "ai_agent", query: params },
        });
        
        return { 
          success: true, 
          data: { 
            contact, 
            jobs: contactJobs, 
            estimates: contactEstimates, 
            invoices: contactInvoices 
          } 
        };
      }

      case "create_job": {
        const params = createJobSchema.parse(args);
        
        const contact = await storage.getContact(params.contactId);
        if (!contact) {
          if (ledgerEntryId) {
            await markLedgerFailed({ ledgerId: ledgerEntryId, reason: "Contact not found for job creation" });
          }
          return { success: false, error: "Contact not found" };
        }
        
        const job = await storage.createJob({
          title: params.title,
          description: params.description ?? null,
          status: params.status ?? "lead_intake",
          clientId: params.contactId,
        });
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "create_job",
          entityType: "job",
          entityId: job.id,
          details: { source: "ai_agent", ...params },
        });
        
        // Update ledger entry on success with snapshot
        if (ledgerEntryId) {
          await markLedgerSuccess({
            ledgerId: ledgerEntryId,
            entityId: job.id,
            diffJson: createDiff(job as unknown as Record<string, unknown>),
          });
        }
        
        return { success: true, data: job };
      }

      case "update_job": {
        const params = updateJobSchema.parse(args);
        
        const existingJob = await storage.getJob(params.jobId);
        if (!existingJob) {
          if (ledgerEntryId) {
            await markLedgerFailed({ ledgerId: ledgerEntryId, reason: "Job not found" });
          }
          return { success: false, error: "Job not found" };
        }
        
        // Build updates object with only provided fields
        const updates: Record<string, unknown> = {};
        const providedFields: Record<string, unknown> = {};
        
        if (params.title !== undefined) {
          updates.title = params.title;
          providedFields.title = params.title;
        }
        if (params.description !== undefined) {
          updates.description = params.description;
          providedFields.description = params.description;
        }
        if (params.value !== undefined) {
          updates.value = params.value;
          providedFields.value = params.value;
        }
        if (params.deadline !== undefined) {
          const deadlineDate = new Date(params.deadline);
          if (!Number.isFinite(deadlineDate.getTime())) {
            if (ledgerEntryId) {
              await markLedgerFailed({ ledgerId: ledgerEntryId, reason: "Invalid deadline date" });
            }
            return { success: false, error: "Invalid deadline date" };
          }
          updates.deadline = deadlineDate;
          providedFields.deadline = params.deadline;
        }
        if (params.scheduledStart !== undefined) {
          const startDate = new Date(params.scheduledStart);
          if (!Number.isFinite(startDate.getTime())) {
            return { success: false, error: "Invalid scheduledStart date" };
          }
          updates.scheduledStart = startDate;
          providedFields.scheduledStart = params.scheduledStart;
        }
        if (params.scheduledEnd !== undefined) {
          const endDate = new Date(params.scheduledEnd);
          if (!Number.isFinite(endDate.getTime())) {
            return { success: false, error: "Invalid scheduledEnd date" };
          }
          updates.scheduledEnd = endDate;
          providedFields.scheduledEnd = params.scheduledEnd;
        }
        if (params.jobType !== undefined) {
          updates.jobType = params.jobType;
          providedFields.jobType = params.jobType;
        }
        
        const job = await storage.updateJob(params.jobId, updates);
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "update_job",
          entityType: "job",
          entityId: params.jobId,
          details: { 
            source: "ai_agent",
            jobId: params.jobId,
            fieldsUpdated: Object.keys(providedFields),
            values: providedFields
          },
        });
        
        return { success: true, data: job };
      }

      case "add_note": {
        const params = addNoteSchema.parse(args);
        
        if (params.entityType === "contact") {
          const contact = await storage.getContact(params.entityId);
          if (!contact) {
            return { success: false, error: "Contact not found" };
          }
        } else {
          const job = await storage.getJob(params.entityId);
          if (!job) {
            return { success: false, error: "Job not found" };
          }
        }
        
        const category = params.category ?? "general";
        const note = await storage.createNote({
          title: `${category.charAt(0).toUpperCase() + category.slice(1)} Note`,
          content: params.content,
          entityType: params.entityType,
          entityId: params.entityId,
        });
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "add_note",
          entityType: "note",
          entityId: note.id,
          details: { source: "ai_agent", ...params },
        });
        
        return { success: true, data: note };
      }

      case "schedule_appointment": {
        const params = scheduleAppointmentSchema.parse(args);
        
        const job = await storage.getJob(params.jobId);
        if (!job) {
          return { success: false, error: "Job not found" };
        }
        
        if (!job.clientId) {
          return { success: false, error: "Job has no associated contact" };
        }
        
        const appointment = await storage.createAppointment({
          title: `Appointment for Job: ${job.title}`,
          contactId: job.clientId,
          scheduledAt: new Date(params.scheduledAt),
          duration: params.duration ?? 60,
          status: "scheduled",
          notes: params.notes ?? null,
        });
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "schedule_appointment",
          entityType: "appointment",
          entityId: appointment.id,
          details: { source: "ai_agent", jobId: params.jobId, scheduledAt: params.scheduledAt },
        });
        
        return { success: true, data: appointment };
      }

      case "create_estimate": {
        const params = createEstimateSchema.parse(args);
        
        const contact = await storage.getContact(params.contactId);
        if (!contact) {
          return { success: false, error: "Contact not found" };
        }
        
        if (params.jobId) {
          const job = await storage.getJob(params.jobId);
          if (!job) {
            return { success: false, error: "Job not found" };
          }
        }
        
        const estimate = await storage.createEstimate({
          contactId: params.contactId,
          jobId: params.jobId ?? null,
          status: "draft",
          lineItems: params.lineItems,
          subtotal: params.subtotal,
          taxTotal: params.taxAmount,
          totalAmount: params.totalAmount,
          validUntil: params.validUntil ? new Date(params.validUntil) : null,
          notes: params.notes ?? null,
        });
        
        await storage.createAuditLogEntry({
          userId: null,
          action: "create_estimate",
          entityType: "estimate",
          entityId: estimate.id,
          details: { source: "ai_agent", ...params },
        });
        
        return { success: true, data: estimate };
      }

      case "accept_estimate": {
        const params = acceptEstimateSchema.parse(args);
        const result = await acceptEstimate(params.estimateId);
        return { success: true, data: result };
      }

      case "reject_estimate": {
        const params = rejectEstimateSchema.parse(args);
        const estimate = await rejectEstimate(params.estimateId);
        return { success: true, data: estimate };
      }

      case "send_estimate": {
        const params = sendEstimateSchema.parse(args);
        const estimate = await sendEstimate(params.estimateId);
        return { success: true, data: estimate };
      }

      case "create_invoice": {
        const params = createInvoiceSchema.parse(args);
        
        const job = await storage.getJob(params.jobId);
        if (!job) {
          return { success: false, error: "Job not found" };
        }
        
        const contact = await storage.getContact(params.contactId);
        if (!contact) {
          return { success: false, error: "Contact not found" };
        }
        
        if (params.estimateId) {
          const estimate = await storage.getEstimate(params.estimateId);
          if (!estimate) {
            return { success: false, error: "Estimate not found" };
          }
        }
        
        const invoice = await storage.createInvoice({
          jobId: params.jobId,
          contactId: params.contactId,
          estimateId: params.estimateId ?? null,
          status: "draft",
          lineItems: params.lineItems,
          subtotal: params.subtotal,
          taxTotal: params.taxAmount,
          totalAmount: params.totalAmount,
          issuedAt: null,
          dueAt: params.dueDate ? new Date(params.dueDate) : null,
          paidAt: null,
          notes: params.notes ?? null,
        });
        
        await storage.createAuditLogEntry({
          userId: null,
          action: "create_invoice",
          entityType: "invoice",
          entityId: invoice.id,
          details: { source: "ai_agent", ...params },
        });
        
        return { success: true, data: invoice };
      }

      case "record_payment": {
        const params = recordPaymentSchema.parse(args);
        const invoice = await recordPayment(
          params.invoiceId,
          params.amount,
          params.method,
          params.transactionRef
        );
        return { success: true, data: invoice };
      }

      case "assign_technician": {
        const params = assignTechnicianSchema.parse(args);
        const job = await assignTechnician(params.jobId, params.technicianId);
        return { success: true, data: job };
      }

      case "update_job_status": {
        const params = updateJobStatusSchema.parse(args);
        const job = await updateJobStatus(params.jobId, params.status);
        return { success: true, data: job };
      }

      case "start_job": {
        const params = startJobSchema.parse(args);
        const job = await startJob(params.jobId);
        return { success: true, data: job };
      }

      case "complete_job": {
        const params = completeJobSchema.parse(args);
        const job = await completeJob(params.jobId);
        return { success: true, data: job };
      }

      case "send_invoice": {
        const params = sendInvoiceSchema.parse(args);
        const invoice = await sendInvoice(params.invoiceId);
        return { success: true, data: invoice };
      }

      case "search_pricebook": {
        const params = searchPricebookSchema.parse(args);
        
        const items = await storage.getPricebookItems();
        const query = params.query.toLowerCase();
        
        const filtered = items.filter(item => {
          const nameMatch = item.name?.toLowerCase().includes(query) ?? false;
          const skuMatch = item.sku?.toLowerCase().includes(query) ?? false;
          const categoryMatch = params.category ? item.category === params.category : true;
          return (nameMatch || skuMatch) && categoryMatch && item.active;
        });
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "search_pricebook",
          entityType: "pricebook",
          entityId: null,
          details: { source: "ai_agent", query: params.query, category: params.category, resultsCount: filtered.length },
        });
        
        return { success: true, data: filtered };
      }

      case "search_jobs": {
        const params = searchJobsSchema.parse(args);
        
        const jobs = await storage.getJobs();
        
        const filtered = jobs.filter(job => {
          const queryMatch = params.query 
            ? job.title?.toLowerCase().includes(params.query.toLowerCase()) ?? false
            : true;
          const statusMatch = params.status ? job.status === params.status : true;
          const contactMatch = params.contactId ? job.clientId === params.contactId : true;
          return queryMatch && statusMatch && contactMatch;
        });
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "search_jobs",
          entityType: "job",
          entityId: null,
          details: { source: "ai_agent", ...params, resultsCount: filtered.length },
        });
        
        return { success: true, data: filtered };
      }

      case "get_invoice": {
        const params = getInvoiceSchema.parse(args);
        
        const invoice = await storage.getInvoice(params.invoiceId);
        if (!invoice) {
          return { success: false, error: "Invoice not found" };
        }
        
        const payments = await storage.getPayments();
        const invoicePayments = payments.filter(p => p.invoiceId === params.invoiceId);
        const totalPaid = invoicePayments
          .filter(p => p.status === "completed")
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "get_invoice",
          entityType: "invoice",
          entityId: params.invoiceId,
          details: { source: "ai_agent" },
        });
        
        return { 
          success: true, 
          data: { 
            invoice, 
            payments: invoicePayments,
            totalPaid: totalPaid.toFixed(2),
            outstandingBalance: (parseFloat(invoice.totalAmount) - totalPaid).toFixed(2)
          } 
        };
      }

      case "get_estimate": {
        const params = getEstimateSchema.parse(args);
        
        const estimate = await storage.getEstimate(params.estimateId);
        if (!estimate) {
          return { success: false, error: "Estimate not found" };
        }
        
        await storage.createAuditLogEntry({
          userId: userId ?? null,
          action: "get_estimate",
          entityType: "estimate",
          entityId: params.estimateId,
          details: { source: "ai_agent" },
        });
        
        return { success: true, data: estimate };
      }

      case "get_crm_stats": {
        const [contacts, jobs, estimates, invoices] = await Promise.all([
          storage.getContacts(),
          storage.getJobs(),
          storage.getEstimates(),
          storage.getInvoices(),
        ]);
        
        const leadCount = contacts.filter(c => c.status === "new" || c.status === "contacted").length;
        const activeJobCount = jobs.filter(j => j.status === "in_progress" || j.status === "scheduled").length;
        const pendingEstimates = estimates.filter(e => e.status === "draft" || e.status === "sent").length;
        const unpaidInvoices = invoices.filter(i => i.status !== "paid").length;
        
        return { 
          success: true, 
          data: {
            contacts_count: contacts.length,
            jobs_count: jobs.length,
            leads_count: leadCount,
            active_jobs_count: activeJobCount,
            estimates_count: estimates.length,
            pending_estimates_count: pendingEstimates,
            invoices_count: invoices.length,
            unpaid_invoices_count: unpaidInvoices,
          }
        };
      }

      case "query_automation_ledger": {
        const params = args as { actionType?: string; status?: string; agentName?: string; limit?: string };
        const limit = params.limit ? parseInt(params.limit, 10) : 20;
        
        const entries = await storage.getAutomationLedgerEntries({
          actionType: params.actionType,
          status: params.status,
          agentName: params.agentName,
          limit,
        });
        
        return { 
          success: true, 
          data: {
            total_count: entries.length,
            entries: entries.map(e => ({
              id: e.id,
              agentName: e.agentName,
              actionType: e.actionType,
              entityType: e.entityType,
              entityId: e.entityId,
              status: e.status,
              reason: e.reason,
              timestamp: e.timestamp,
            })),
          }
        };
      }

      case "query_review_queue": {
        const params = args as { status?: string; limit?: string };
        const limit = params.limit ? parseInt(params.limit, 10) : 20;
        
        const allEntries = await storage.getAssistQueue();
        
        let filtered = allEntries;
        if (params.status && params.status !== "all") {
          filtered = allEntries.filter((e: { status: string }) => e.status === params.status);
        }
        
        const pending = allEntries.filter((e: { status: string }) => e.status === "pending");
        const approved = allEntries.filter((e: { status: string }) => e.status === "approved");
        const rejected = allEntries.filter((e: { status: string }) => e.status === "rejected");
        
        return { 
          success: true, 
          data: {
            pending_count: pending.length,
            approved_count: approved.length,
            rejected_count: rejected.length,
            total_count: allEntries.length,
            entries: filtered.slice(0, limit).map((e: { id: string; userRequest: string; status: string; mode: string; requiresApproval: boolean; createdAt: Date }) => ({
              id: e.id,
              userRequest: e.userRequest,
              status: e.status,
              mode: e.mode,
              requiresApproval: e.requiresApproval,
              createdAt: e.createdAt,
            })),
          }
        };
      }

      case "query_ready_execution": {
        const params = args as { limit?: string };
        const limit = params.limit ? parseInt(params.limit, 10) : 20;
        
        // Ready Execution shows items with status 'ai_validated' from automation_ledger
        // OR approved items from assist_queue
        const ledgerEntries = await storage.getAutomationLedgerEntries({
          status: "ai_validated",
          limit,
        });
        
        const assistEntries = await storage.getAssistQueue();
        const approvedAssist = assistEntries.filter((e: { status: string }) => e.status === "approved");
        
        return { 
          success: true, 
          data: {
            awaiting_human_decision: ledgerEntries.length + approvedAssist.length,
            ledger_items: ledgerEntries.map((e: { id: string; agentName: string; actionType: string; entityType: string; status: string; timestamp: Date }) => ({
              id: e.id,
              agentName: e.agentName,
              actionType: e.actionType,
              entityType: e.entityType,
              status: e.status,
              timestamp: e.timestamp,
            })),
            approved_proposals: approvedAssist.map((e: { id: string; userRequest: string; status: string; createdAt: Date }) => ({
              id: e.id,
              userRequest: e.userRequest,
              status: e.status,
              createdAt: e.createdAt,
            })),
          }
        };
      }

      case "resolve_document": {
        const params = args as { title?: string; contactId?: string; jobId?: string; documentType?: string; limit?: number };
        
        // Require at least one search parameter
        if (!params.title && !params.contactId && !params.jobId) {
          return {
            success: false,
            error: "At least one of title, contactId, or jobId is required. Provide the document name or context to find it."
          };
        }
        
        const docLimit = params.limit || 5;
        
        const documents = await storage.getDocumentArtifacts({
          title: params.title,
          contactId: params.contactId,
          jobId: params.jobId,
          documentType: params.documentType || "google_doc",
          limit: docLimit,
        });
        
        if (documents.length === 0) {
          return {
            success: true,
            data: {
              found: false,
              message: params.title 
                ? `No documents found matching "${params.title}". The document may not exist yet or was created with a different name.`
                : "No documents found for the specified context. Use google_docs_create to create a new document first.",
              documents: [],
              searchCriteria: { title: params.title, contactId: params.contactId, jobId: params.jobId },
            }
          };
        }
        
        return {
          success: true,
          data: {
            found: true,
            count: documents.length,
            documents: documents.map(d => ({
              documentId: d.documentId,
              title: d.title,
              documentUrl: d.documentUrl,
              documentType: d.documentType,
              createdAt: d.createdAt,
              contactId: d.contactId,
              jobId: d.jobId,
            })),
            latest: {
              documentId: documents[0].documentId,
              title: documents[0].title,
              documentUrl: documents[0].documentUrl,
            }
          }
        };
      }

      default:
        return { 
          success: false, 
          error: `Unknown tool: ${toolName}` 
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Update ledger entry on failure
    if (ledgerEntryId) {
      try {
        await markLedgerFailed({ ledgerId: ledgerEntryId, reason: message });
      } catch (ledgerError) {
        console.error("[AutomationLedger] Failed to update ledger on failure:", ledgerError);
      }
    }
    
    return { 
      success: false, 
      error: message 
    };
  }
}
