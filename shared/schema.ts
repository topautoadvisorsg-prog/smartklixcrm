import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, numeric, real, index, uniqueIndex, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles for approval authorization:
// - "master_architect": Can approve all actions, full autonomy control
// - "admin": Can approve all actions
// - "staff": Cannot approve gated actions
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("staff"), // "master_architect" | "admin" | "staff"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  countryCode: text("country_code"),
  company: text("company"),
  status: text("status").notNull().default("new"),
  avatar: text("avatar"),
  // Customer type: customer, lead, prospect
  customerType: text("customer_type").notNull().default("lead"),
  // Contact type: individual or business
  contactType: text("contact_type").notNull().default("individual"), // individual | business
  // Lead source tracking
  source: text("source").default("manual"), // crawler, manual, referral, intake
  // Niche/industry for agent routing (healthcare, construction, etc.)
  // NOTE: UI label changed to "Industry" for agency context
  niche: text("niche"),
  // Client website URL (essential for web/marketing agencies)
  website: text("website"),
  // Preferred contact channel for agents (email, whatsapp, sms)
  preferredChannel: text("preferred_channel").default("email"),
  // Agent integration tracking
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  // Billing address fields
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  // General contact fields
  title: text("title"),
  address: text("address"),
  deletedAt: timestamp("deleted_at"),
  // Stripe integration
  stripeCustomerId: text("stripe_customer_id"),
  // Google Drive integration
  driveFolderId: text("drive_folder_id"),
  driveFolderUrl: text("drive_folder_url"),
  // Metadata for email tracking, agent data, etc.
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  // Tags for categorization
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  stripeCustomerIdIdx: index("contacts_stripe_customer_id_idx").on(table.stripeCustomerId),
  customerTypeIdx: index("contacts_customer_type_idx").on(table.customerType),
  nicheIdx: index("contacts_niche_idx").on(table.niche),
  preferredChannelIdx: index("contacts_preferred_channel_idx").on(table.preferredChannel),
}));

// ========================================
// LOCATIONS (Service Locations for Customers)
// ========================================

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Main Office", "Warehouse", "Home"
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  contactIdIdx: index("locations_contact_id_idx").on(table.contactId),
}));

// ========================================
// EQUIPMENT (Equipment at Locations)
// ========================================

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  model: text("model"),
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  installDate: timestamp("install_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  notes: text("notes"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  locationIdIdx: index("equipment_location_id_idx").on(table.locationId),
  serialNumberIdx: index("equipment_serial_number_idx").on(table.serialNumber),
}));

// ========================================
// PRICEBOOK (Parts, Labor, Services)
// ========================================

export const pricebookItems = pgTable("pricebook_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("service"), // part, labor, service, material
  unitPrice: numeric("unit_price").notNull().default("0"),
  unitCost: numeric("unit_cost").notNull().default("0"), // Internal cost - hidden in presentation
  unit: text("unit").notNull().default("each"), // each, hour, sqft, etc.
  tier: text("tier"), // good, better, best - for GBB presentation
  taxable: boolean("taxable").notNull().default(true),
  active: boolean("active").notNull().default(true),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  skuIdx: index("pricebook_items_sku_idx").on(table.sku),
  categoryIdx: index("pricebook_items_category_idx").on(table.category),
  tierIdx: index("pricebook_items_tier_idx").on(table.tier),
}));

// ========================================
// TAGS (Global Tag Registry)
// ========================================

export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color").default("#6B7280"), // Hex color for display
  entityTypes: text("entity_types").array().default(sql`ARRAY['contact', 'job', 'location']::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("tags_name_idx").on(table.name),
}));

// ========================================
// STORED PAYMENT METHODS (Stripe PaymentMethods)
// ========================================

export const storedPaymentMethods = pgTable("stored_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  type: text("type").notNull().default("card"), // card, us_bank_account, etc.
  last4: text("last4"),
  brand: text("brand"), // visa, mastercard, amex
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  contactIdIdx: index("stored_payment_methods_contact_id_idx").on(table.contactId),
  stripePaymentMethodIdIdx: index("stored_payment_methods_stripe_pm_idx").on(table.stripePaymentMethodId),
}));

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  clientId: varchar("client_id").references(() => contacts.id),
  locationId: varchar("location_id").references(() => locations.id), // Service location for this job
  status: text("status").notNull().default("lead_intake"),
  estimatedValue: numeric("estimated_value"), // renamed from value
  actualValue: numeric("actual_value"), // actual billed amount from invoices
  deadline: timestamp("deadline"),
  scope: text("scope"), // renamed from description - service scope/deliverables
  jobType: text("job_type").notNull().default("project"), // project, recurring, emergency
  // Agency-specific fields
  projectType: text("project_type").default("website"), // website, marketing, consulting
  repositoryUrl: text("repository_url"), // GitHub, GitLab
  designUrl: text("design_url"), // Figma, Sketch
  jobNumber: text("job_number"),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  closedAt: timestamp("closed_at"),
  assignedTechs: jsonb("assigned_techs").default(sql`'[]'::jsonb`),
  sourceLeadId: varchar("source_lead_id"),
  sourceEstimateId: varchar("source_estimate_id"),
  // Dispatch fields
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  // Google Drive integration
  driveFolderId: text("drive_folder_id"),
  driveFolderUrl: text("drive_folder_url"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("jobs_status_idx").on(table.status),
  locationIdIdx: index("jobs_location_id_idx").on(table.locationId),
  priorityIdx: index("jobs_priority_idx").on(table.priority),
}));

// ========================================
// FIELD REPORTS (Mobile App / Field Worker Input)
// ========================================
// Purpose: Structured field documentation tied to jobs and contacts
// Every report must have a type for proper categorization

export const fieldReports = pgTable("field_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("progress"), // progress | issue | completion | inspection
  observations: text("observations"), // what was observed/found (renamed from notes)
  actionsTaken: text("actions_taken"), // what actions were performed
  recommendations: text("recommendations"), // recommended next steps
  severity: text("severity").default("low"), // low, medium, high, critical - for issue-type reports
  resolutionStatus: text("resolution_status").default("open"), // open, in_progress, resolved, escalated - for issues
  startedAt: timestamp("started_at").defaultNow(), // work start time
  completedAt: timestamp("completed_at"), // work end time
  durationMinutes: integer("duration_minutes"), // calculated duration
  photos: text("photos").array().default(sql`ARRAY[]::text[]`), // array of photo URLs
  statusUpdate: text("status_update"), // progress description (kept for backward compatibility)
  createdBy: varchar("created_by").references(() => users.id), // worker who created report
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  jobIdIdx: index("field_reports_job_id_idx").on(table.jobId),
  contactIdIdx: index("field_reports_contact_id_idx").on(table.contactId),
  typeIdx: index("field_reports_type_idx").on(table.type),
}));

// ========================================
// FINANCIAL RECORDS (Internal Job Economics Tracking)
// ========================================
// Purpose: Operational tracking of job-level income/expenses
// This is SEPARATE from invoices/payments (external billing system)
// Financial Records = internal tracking, Invoices/Payments = customer billing

export const financialRecords = pgTable("financial_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // income | expense
  category: text("category").notNull().default("other"), // materials, labor, travel, equipment, subcontractor, permit, payment_received, refund, other
  amount: numeric("amount").notNull(),
  isEstimated: boolean("is_estimated").notNull().default(false), // estimated vs actual flag
  paymentStatus: text("payment_status").default("pending"), // pending, completed, failed, refunded
  paymentMethod: text("payment_method"), // cash, card, bank_transfer, check, online, other
  transactionRef: text("transaction_ref"), // external reference/transaction ID
  isBillable: boolean("is_billable").notNull().default(true), // whether expense can be billed to client
  description: text("description"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  jobIdIdx: index("financial_records_job_id_idx").on(table.jobId),
  contactIdIdx: index("financial_records_contact_id_idx").on(table.contactId),
  typeIdx: index("financial_records_type_idx").on(table.type),
  dateIdx: index("financial_records_date_idx").on(table.date),
  categoryIdx: index("financial_records_category_idx").on(table.category),
}));

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  contactId: varchar("contact_id").references(() => contacts.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").notNull().default(60),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  url: text("url"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// WORKSPACE FILES (Google Workspace Artifact Mirror)
// ========================================

export const workspaceFiles = pgTable("workspace_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleFileId: text("google_file_id").notNull(), // Google Drive/Docs/Sheets file ID
  name: text("name").notNull(),
  type: text("type").notNull(), // 'doc' | 'sheet' | 'drive'
  url: text("url").notNull(), // Direct Google URL to open file
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  lastModifiedBy: text("last_modified_by"), // Name of person who last modified
  lastModifiedTime: timestamp("last_modified_time"),
  status: text("status").notNull().default("active"), // 'active' | 'orphaned'
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Additional Google API metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  googleFileIdIdx: uniqueIndex("workspace_files_google_file_id_idx").on(table.googleFileId),
  jobIdIdx: index("workspace_files_job_id_idx").on(table.jobId),
  contactIdIdx: index("workspace_files_contact_id_idx").on(table.contactId),
  typeIdx: index("workspace_files_type_idx").on(table.type),
}));

export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  jobId: varchar("job_id").references(() => jobs.id),
  status: text("status").notNull().default("draft"),
  lineItems: jsonb("line_items").notNull().default(sql`'[]'::jsonb`),
  subtotal: numeric("subtotal").notNull().default("0"),
  taxTotal: numeric("tax_total").notNull().default("0"),
  totalAmount: numeric("total_amount").notNull().default("0"),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// JOB TASKS (Checklist items for jobs)
// ========================================

export const jobTasks = pgTable("job_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  jobIdIdx: index("job_tasks_job_id_idx").on(table.jobId),
}));

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number"), // Human-readable invoice number
  jobId: varchar("job_id").references(() => jobs.id), // Made optional for standalone invoices
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  estimateId: varchar("estimate_id").references(() => estimates.id),
  status: text("status").notNull().default("draft"),
  lineItems: jsonb("line_items").notNull().default(sql`'[]'::jsonb`),
  subtotal: numeric("subtotal").notNull().default("0"),
  taxTotal: numeric("tax_total").notNull().default("0"),
  totalAmount: numeric("total_amount").notNull().default("0"),
  issuedAt: timestamp("issued_at"),
  dueAt: timestamp("due_at"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  // Accounting sync placeholders (QuickBooks/Xero)
  syncEnabled: boolean("sync_enabled").notNull().default(false),
  externalInvoiceId: text("external_invoice_id"), // QBO/Xero invoice ID
  accountingIntegration: jsonb("accounting_integration").default(sql`'{}'::jsonb`), // Future sync metadata
  lastSyncedAt: timestamp("last_synced_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  invoiceNumberIdx: index("invoices_invoice_number_idx").on(table.invoiceNumber),
  externalInvoiceIdIdx: index("invoices_external_invoice_id_idx").on(table.externalInvoiceId),
}));

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  contactId: varchar("contact_id").references(() => contacts.id), // Direct link to customer
  amount: numeric("amount").notNull(),
  method: text("method").notNull().default("cash"), // cash, card, check, stripe
  transactionRef: text("transaction_ref"),
  // Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  status: text("status").notNull().default("pending"), // pending, completed, failed, refunded
  // Origin tracking for governance model
  origin: text("origin").notNull().default("human"), // "human" | "ai" - determines Review Queue routing
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  stripePaymentIntentIdIdx: index("payments_stripe_pi_idx").on(table.stripePaymentIntentId),
  contactIdIdx: index("payments_contact_id_idx").on(table.contactId),
}));

// ========================================
// PAYMENT SLIPS (Draft Payments for Execution)
// ========================================
// Payment Slips are structured draft payloads that match Stripe-required fields.
// They can be Human-created (execute immediately via EOA) or AI-created (require Review Queue approval first).
// Payment records in the payments table are immutable results from Stripe webhooks.
export const paymentSlips = pgTable("payment_slips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Origin determines authority flow: human = direct EOA, ai = Review Queue first
  origin: text("origin").notNull().default("human"), // "human" | "ai"
  // Status: draft (created) -> approved (AI only) -> sent (to n8n) -> completed/failed (from Stripe)
  status: text("status").notNull().default("draft"), // draft, approved, sent, completed, failed
  // Amount
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("usd"),
  // Customer info (Stripe-aligned)
  contactId: varchar("contact_id").references(() => contacts.id),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  // Description
  description: text("description"),
  memo: text("memo"),
  // Optional linkages
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  estimateId: varchar("estimate_id").references(() => estimates.id),
  jobId: varchar("job_id").references(() => jobs.id),
  // Payment method types
  paymentMethodTypes: text("payment_method_types").array().default(sql`ARRAY['card']::text[]`), // card, us_bank_account, terminal
  // Stripe refs (filled AFTER execution)
  stripeIntentId: text("stripe_intent_id"),
  processorRef: text("processor_ref"),
  // Correlation ID for observability (generated on execution, format: pay_<nanoid>)
  traceId: text("trace_id"),
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("payment_slips_status_idx").on(table.status),
  originIdx: index("payment_slips_origin_idx").on(table.origin),
  contactIdIdx: index("payment_slips_contact_id_idx").on(table.contactId),
}));

/**
 * @deprecated Legacy queue system. Retained for rollback safety.
 * All new flows use staged_proposals.
 */
export const assistQueue = pgTable("assist_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  mode: text("mode").notNull(),
  userRequest: text("user_request").notNull(),
  status: text("status").notNull().default("pending"),
  agentResponse: text("agent_response"),
  toolsCalled: jsonb("tools_called").default(sql`'[]'::jsonb`),
  toolResults: jsonb("tool_results").default(sql`'[]'::jsonb`),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  // Gated action tracking fields
  gatedActionType: text("gated_action_type"), // Tool name like "send_invoice", "send_estimate", "record_payment"
  finalizationPayload: jsonb("finalization_payload"), // Arguments to execute when approved
  architectApprovedAt: timestamp("architect_approved_at"), // When Master Architect approved
  // P0 HARDENING: Idempotency & Governance
  idempotencyKey: varchar("idempotency_key").unique(), // UUID-based deduplication key
  reasoningSummary: text("reasoning_summary"), // AI decision rationale for audit trail
  // VALIDATOR INTEGRATION: Decision tracking
  validatorDecision: text("validator_decision"), // approve/reject from validator
  validatorRiskLevel: text("validator_risk_level"), // low/medium/high/critical
  // P1 HARDENING: Rejection escalation
  rejectionCount: integer("rejection_count").notNull().default(0), // Twice-rejected → escalate
  escalatedToOperator: boolean("escalated_to_operator").notNull().default(false), // Flagged for operator review
  escalatedAt: timestamp("escalated_at"), // When escalation happened
  // Manual handling tracking
  handledManually: boolean("handled_manually").notNull().default(false), // Operator rejected and handled outside AI
  manualHandlingNote: text("manual_handling_note"), // Operator notes for manual resolution
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  idempotencyKeyIdx: index("assist_queue_idempotency_key_idx").on(table.idempotencyKey),
  statusIdx: index("assist_queue_status_idx").on(table.status),
  escalatedIdx: index("assist_queue_escalated_idx").on(table.escalatedToOperator),
}));

export const aiReflection = pgTable("ai_reflection", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assistQueueId: varchar("assist_queue_id").references(() => assistQueue.id),
  auditLogId: varchar("audit_log_id").references(() => auditLog.id),
  userRequest: text("user_request").notNull(),
  initialPlan: text("initial_plan"),
  reflectionPrompt: text("reflection_prompt").notNull(),
  reflectionOutput: text("reflection_output").notNull(),
  revisedPlan: text("revised_plan"),
  approved: boolean("approved").notNull().default(false),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default('default'),
  agentMode: text("agent_mode").notNull().default("assist"),
  autoEmail: boolean("auto_email").notNull().default(true),
  autoSchedule: boolean("auto_schedule").notNull().default(true),
  autoStatus: boolean("auto_status").notNull().default(false),
  companyName: text("company_name").default("Smart Klix CRM"),
  primaryColor: text("primary_color").default("#FDB913"),
  secondaryColor: text("secondary_color").default("#1E40AF"),
  logoUrl: text("logo_url"),
  // Tax configuration
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).notNull().default("8.25"),
  // Integration settings
  n8nWebhookUrl: text("n8n_webhook_url"),
  openaiApiKey: text("openai_api_key"),
  stripeSecretKey: text("stripe_secret_key"),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  sendgridApiKey: text("sendgrid_api_key"),
  // Communication templates
  smsTemplateAppointment: text("sms_template_appointment"),
  smsTemplateInvoice: text("sms_template_invoice"),
  emailTemplateEstimate: text("email_template_estimate"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiTasks = pgTable("ai_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assistQueueId: varchar("assist_queue_id").references(() => assistQueue.id),
  auditLogId: varchar("audit_log_id").references(() => auditLog.id),
  taskType: text("task_type").notNull(),
  delegatedTo: text("delegated_to").notNull().default("neo8"),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  result: jsonb("result"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  attemptedAt: timestamp("attempted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  // Client ID in format: first_name_4digits (e.g., joe_4837) - primary identifier
  clientId: text("client_id"),
  // Conversation ID for Neo8 lifecycle grouping (e.g., joe_4837-1)
  conversationId: text("conversation_id"),
  status: text("status").notNull().default("active"),
  // Channel: widget, whatsapp, sms
  channel: text("channel").notNull().default("widget"),
  // WhatsApp session status: active, expiring, expired (24h window)
  sessionStatus: text("session_status").default("active"),
  // When the WhatsApp session expires (24h from last customer message)
  sessionExpiresAt: timestamp("session_expires_at"),
  // Urgency score for triage sorting (0-100)
  urgencyScore: integer("urgency_score").default(50),
  // Assigned operator user ID
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  sessionToken: text("session_token"),
  leadScore: integer("lead_score"),
  lastMessageAt: timestamp("last_message_at"),
  // Job reference for dispatch context
  jobId: varchar("job_id").references(() => jobs.id),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  contactIdIdx: index("conversations_contact_id_idx").on(table.contactId),
  contactIdStatusIdx: index("conversations_contact_status_idx").on(table.contactId, table.status),
  lastMessageAtIdx: index("conversations_last_message_at_idx").on(table.lastMessageAt),
  sessionTokenIdx: index("conversations_session_token_idx").on(table.sessionToken),
  clientIdIdx: index("conversations_client_id_idx").on(table.clientId),
  conversationIdIdx: index("conversations_conversation_id_idx").on(table.conversationId),
  channelIdx: index("conversations_channel_idx").on(table.channel),
  sessionStatusIdx: index("conversations_session_status_idx").on(table.sessionStatus),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  // Sender type: customer, operator, system, ai_draft
  senderType: text("sender_type").default("operator"),
  // Message status: sent, delivered, read, failed
  messageStatus: text("message_status").default("sent"),
  // Media attachments
  media: jsonb("media").default(sql`'[]'::jsonb`),
  // Provider-specific message ID (metadata only, never used as primary key)
  providerMessageId: text("provider_message_id"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdCreatedAtIdx: index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  senderTypeIdx: index("messages_sender_type_idx").on(table.senderType),
  messageStatusIdx: index("messages_message_status_idx").on(table.messageStatus),
}));

export const memoryEntries = pgTable("memory_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  summary: text("summary"),
  embedding: vector("embedding", { dimensions: 1536 }),
  importance: integer("importance").notNull().default(5),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdIdx: index("memory_conversation_id_idx").on(table.conversationId),
  contactIdIdx: index("memory_contact_id_idx").on(table.contactId),
}));

// AI Settings - Per-entity configuration for the 4 AI surfaces
// Matches the AI Settings tab in the UI
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default('default'),
  
  // Intake Agent (Widget) - Public chat intake
  edgeAgentPrompt: text("edge_agent_prompt"),
  edgeAgentConstraints: jsonb("edge_agent_constraints").default(sql`'[]'::jsonb`),
  edgeAgentEnabled: boolean("edge_agent_enabled").notNull().default(true),
  
  // Query Agent (Information AI Chat) - Read-only CRM queries
  discoveryAiPrompt: text("discovery_ai_prompt"),
  discoveryAiConstraints: jsonb("discovery_ai_constraints").default(sql`'[]'::jsonb`),
  discoveryAiEnabled: boolean("discovery_ai_enabled").notNull().default(true),
  
  // Proposal Agent - Action Console execution
  actionAiPrompt: text("action_ai_prompt"),
  actionAiConstraints: jsonb("action_ai_constraints").default(sql`'[]'::jsonb`),
  actionAiEnabled: boolean("action_ai_enabled").notNull().default(true),
  
  // Policy Agent - Proposal validation (DEPRECATED)
  /** @deprecated Master Architect removed. All validation now handled by validator.ts. */
  masterArchitectPrompt: text("master_architect_prompt"),
  /** @deprecated Master Architect removed. All validation now handled by validator.ts. */
  masterArchitectConstraints: jsonb("master_architect_constraints").default(sql`'[]'::jsonb`),
  /** @deprecated Master Architect removed. All validation now handled by validator.ts. */
  masterArchitectEnabled: boolean("master_architect_enabled").notNull().default(true),
  
  // Global settings
  companyKnowledge: text("company_knowledge"),
  globalEnabled: boolean("global_enabled").notNull().default(true),
  
  // P0 HARDENING: Global Kill Switch
  killSwitchActive: boolean("kill_switch_active").notNull().default(false), // Halts all execution, dispatch, queue promotion
  killSwitchActivatedAt: timestamp("kill_switch_activated_at"), // When kill switch was triggered
  killSwitchActivatedBy: varchar("kill_switch_activated_by").references(() => users.id), // Who triggered it
  killSwitchReason: text("kill_switch_reason"), // Why it was activated

  // Widget branding / appearance config (stored as JSON)
  widgetConfig: jsonb("widget_config").default(sql`'{}'::jsonb`),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * @deprecated Master Architect removed. All validation now handled by validator.ts.
 * Table retained for database compatibility only.
 */
export const masterArchitectConfig = pgTable("master_architect_config", {
  id: varchar("id").primaryKey().default('default'),
  model: text("model").notNull().default("gpt-4o"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(1500),
  topP: real("top_p").notNull().default(1.0),
  frequencyPenalty: real("frequency_penalty").notNull().default(0.0),
  systemPrompt: text("system_prompt").notNull().default("You are a helpful AI assistant for the Smart Klix CRM."),
  reflectionEnabled: boolean("reflection_enabled").notNull().default(true),
  maxReflectionRounds: integer("max_reflection_rounds").notNull().default(1),
  recursionDepthLimit: integer("recursion_depth_limit").notNull().default(3),
  maxConversationHistory: integer("max_conversation_history").notNull().default(50),
  contextSummarizationEnabled: boolean("context_summarization_enabled").notNull().default(false),
  autoPruneAfterMessages: integer("auto_prune_after_messages").notNull().default(100),
  toolPermissions: jsonb("tool_permissions").default(sql`'{}'::jsonb`),
  channelToolPermissions: jsonb("channel_tool_permissions").default(sql`'{}'::jsonb`),
  finalizationMode: text("finalization_mode").notNull().default("semi_autonomous"), // "fully_autonomous" | "semi_autonomous"
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  method: text("method").notNull().default("POST"),
  payload: jsonb("payload").default(sql`'{}'::jsonb`),
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  errorMessage: text("error_message"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companyInstructions = pgTable("company_instructions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull().unique(),
  behaviorInstructions: text("behavior_instructions"),
  activeChannels: jsonb("active_channels").default(sql`'{"crm_chat":true,"widget":true,"voice":false,"gpt_actions":false}'::jsonb`),
  defaultPipelineStage: text("default_pipeline_stage").default("lead_intake"),
  defaultTags: text("default_tags").array().default(sql`ARRAY[]::text[]`),
  toolPermissionOverrides: jsonb("tool_permission_overrides").default(sql`'{}'::jsonb`),
  customFlags: jsonb("custom_flags").default(sql`'{}'::jsonb`),
  finalizationMode: text("finalization_mode").notNull().default("semi_autonomous"), // "fully_autonomous" | "semi_autonomous"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyNameIdx: index("company_instructions_name_idx").on(table.companyName),
}));

// AI Voice Dispatch Config - DISPATCH & OBSERVABILITY ONLY
// All AI behavior/prompts live on external voice server
// CRM only stores: enabled state, routing, and CRM integration flags
export const aiVoiceDispatchConfig = pgTable("ai_voice_dispatch_config", {
  id: varchar("id").primaryKey().default('default'),
  enabled: boolean("enabled").notNull().default(false),
  
  // Voice Server Routing
  voiceServerUrl: text("voice_server_url"),
  webhookSecret: text("webhook_secret"),
  
  // CRM Integration Flags (what CRM does when call ends)
  storeTranscript: boolean("store_transcript").notNull().default(true),
  autoCreateContact: boolean("auto_create_contact").notNull().default(true),
  autoCreateNote: boolean("auto_create_note").notNull().default(true),
  
  // Dispatch Metadata
  maxCallDuration: integer("max_call_duration").notNull().default(300),
  useOutsideBusinessHours: boolean("use_outside_business_hours").notNull().default(true),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  role: true,
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML email body
  filters: jsonb("filters").default(sql`'{}'::jsonb`), // { tags: [], pipelineStage: "", customerType: "" }
  status: text("status").notNull().default("draft"), // draft, queued, processing, sending, completed, failed
  createdBy: varchar("created_by").references(() => users.id),
  totalRecipients: integer("total_recipients").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("campaigns_status_idx").on(table.status),
  createdByIdx: index("campaigns_created_by_idx").on(table.createdBy),
}));

export const campaignRecipients = pgTable("campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed, bounced, soft_bounced, complained
  providerMessageId: text("provider_message_id"), // Resend message ID
  error: text("error"),
  sentAt: timestamp("sent_at"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Tracking data: opens, clicks, bounces
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdIdx: index("campaign_recipients_campaign_id_idx").on(table.campaignId),
  contactIdIdx: index("campaign_recipients_contact_id_idx").on(table.contactId),
  statusIdx: index("campaign_recipients_status_idx").on(table.status),
  providerMessageIdIdx: index("campaign_recipients_provider_msg_idx").on(table.providerMessageId),
}));

// Email templates for campaigns
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML body with optional {{placeholders}}
  createdBy: varchar("created_by").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  isActiveIdx: index("email_templates_active_idx").on(table.isActive),
}));

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentCount: true,
  failedCount: true,
  startedAt: true,
  completedAt: true,
});

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  lastContactedAt: true,
  nextFollowUpAt: true,
  driveFolderId: true,
  driveFolderUrl: true,
  metadata: true,
}).extend({
  name: z.string().max(500, "Name must be less than 500 characters").nullish(),
  email: z.string().max(500, "Email must be less than 500 characters").nullish(),
  phone: z.string().max(50, "Phone must be less than 50 characters").nullish(),
  company: z.string().max(500, "Company must be less than 500 characters").nullish(),
  website: z.string().max(500, "Website must be less than 500 characters").nullish(),
  address: z.string().max(1000, "Address must be less than 1000 characters").nullish(),
  stripeCustomerId: z.string().max(500).nullish(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  actualValue: true, // calculated from invoices
  jobNumber: true, // auto-generated
}).extend({
  title: z.string().max(500, "Title must be less than 500 characters"),
  scope: z.string().max(5000, "Scope must be less than 5000 characters").optional(),
});

export const insertFieldReportSchema = createInsertSchema(fieldReports).omit({
  id: true,
  createdAt: true,
  durationMinutes: true, // auto-calculated
}).extend({
  observations: z.string().max(5000, "Observations must be less than 5000 characters").optional(),
  actionsTaken: z.string().max(5000, "Actions taken must be less than 5000 characters").optional(),
  recommendations: z.string().max(5000, "Recommendations must be less than 5000 characters").optional(),
  statusUpdate: z.string().max(2000, "Status update must be less than 2000 characters").optional(),
});

export const insertFinancialRecordSchema = createInsertSchema(financialRecords).omit({
  id: true,
  createdAt: true,
}).extend({
  description: z.string().max(2000, "Description must be less than 2000 characters").nullish(),
  category: z.string().max(500, "Category must be less than 500 characters").nullish().default("other"),
  transactionRef: z.string().max(500, "Transaction ref must be less than 500 characters").nullish(),
});

// ========================================
// NEW TABLE INSERT SCHEMAS
// ========================================

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPricebookItemSchema = createInsertSchema(pricebookItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertStoredPaymentMethodSchema = createInsertSchema(storedPaymentMethods).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export const insertWorkspaceFileSchema = createInsertSchema(workspaceFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkspaceFile = z.infer<typeof insertWorkspaceFileSchema>;
export type WorkspaceFile = typeof workspaceFiles.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  timestamp: true,
});

export const insertEstimateSchema = createInsertSchema(estimates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobTaskSchema = createInsertSchema(jobTasks).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSlipSchema = createInsertSchema(paymentSlips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentSlip = z.infer<typeof insertPaymentSlipSchema>;
export type PaymentSlip = typeof paymentSlips.$inferSelect;

export const insertAiReflectionSchema = createInsertSchema(aiReflection).omit({
  id: true,
  createdAt: true,
});

export const insertAiTaskSchema = createInsertSchema(aiTasks).omit({
  id: true,
  createdAt: true,
});

export const insertAssistQueueSchema = createInsertSchema(assistQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({
  id: true,
  createdAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type FieldReport = typeof fieldReports.$inferSelect;
export type InsertFieldReport = z.infer<typeof insertFieldReportSchema>;
export type FinancialRecord = typeof financialRecords.$inferSelect;
export type InsertFinancialRecord = z.infer<typeof insertFinancialRecordSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type FileRecord = typeof files.$inferSelect;
export type InsertFileRecord = z.infer<typeof insertFileSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogSchema>;
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type JobTask = typeof jobTasks.$inferSelect;
export type InsertJobTask = z.infer<typeof insertJobTaskSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// New entity types
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type PricebookItem = typeof pricebookItems.$inferSelect;
export type InsertPricebookItem = z.infer<typeof insertPricebookItemSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type StoredPaymentMethod = typeof storedPaymentMethods.$inferSelect;
export type InsertStoredPaymentMethod = z.infer<typeof insertStoredPaymentMethodSchema>;

export type AiReflection = typeof aiReflection.$inferSelect;
export type InsertAiReflection = z.infer<typeof insertAiReflectionSchema>;
export type AiTask = typeof aiTasks.$inferSelect;
export type InsertAiTask = z.infer<typeof insertAiTaskSchema>;
export type AssistQueueEntry = typeof assistQueue.$inferSelect;
export type InsertAssistQueueEntry = z.infer<typeof insertAssistQueueSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;

export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;

/** @deprecated Master Architect removed. All validation now handled by validator.ts. */
export const insertMasterArchitectConfigSchema = createInsertSchema(masterArchitectConfig).omit({
  id: true,
  updatedAt: true,
});
/** @deprecated Master Architect removed. */
export type InsertMasterArchitectConfig = z.infer<typeof insertMasterArchitectConfigSchema>;
/** @deprecated Master Architect removed. */
export type MasterArchitectConfig = typeof masterArchitectConfig.$inferSelect;

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;

export const insertAiVoiceDispatchConfigSchema = createInsertSchema(aiVoiceDispatchConfig).omit({
  id: true,
  updatedAt: true,
});
export type InsertAiVoiceDispatchConfig = z.infer<typeof insertAiVoiceDispatchConfigSchema>;
export type AiVoiceDispatchConfig = typeof aiVoiceDispatchConfig.$inferSelect;

export const insertCompanyInstructionsSchema = createInsertSchema(companyInstructions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompanyInstructions = z.infer<typeof insertCompanyInstructionsSchema>;
export type CompanyInstructions = typeof companyInstructions.$inferSelect;

// ========================================
// EMAIL MODULE
// ========================================

export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayName: text("display_name").notNull(),
  emailAddress: text("email_address").notNull().unique(),
  incomingHost: text("incoming_host"),
  incomingPort: integer("incoming_port").default(993),
  incomingSsl: boolean("incoming_ssl").notNull().default(true),
  outgoingHost: text("outgoing_host"),
  outgoingPort: integer("outgoing_port").default(587),
  outgoingSsl: boolean("outgoing_ssl").notNull().default(true),
  username: text("username"),
  encryptedPassword: text("encrypted_password"),
  status: text("status").notNull().default("disconnected"), // connected, error, disabled, disconnected
  direction: text("direction").notNull().default("send_receive"), // send_only, send_receive
  defaultCompany: text("default_company"),
  lastSyncAt: timestamp("last_sync_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  emailAddressIdx: index("email_accounts_email_idx").on(table.emailAddress),
  statusIdx: index("email_accounts_status_idx").on(table.status),
}));

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull().references(() => emailAccounts.id, { onDelete: "cascade" }),
  messageId: text("message_id"), // Email's Message-ID header
  threadId: text("thread_id"), // For grouping replies
  direction: text("direction").notNull().default("incoming"), // incoming, outgoing
  fromAddress: text("from_address").notNull(),
  toAddresses: text("to_addresses").array().default(sql`ARRAY[]::text[]`),
  ccAddresses: text("cc_addresses").array().default(sql`ARRAY[]::text[]`),
  bccAddresses: text("bcc_addresses").array().default(sql`ARRAY[]::text[]`),
  subject: text("subject"),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`), // [{name, size, type, url}]
  status: text("status").notNull().default("synced"), // synced, draft, failed, queued, sent
  contactId: varchar("contact_id").references(() => contacts.id),
  jobId: varchar("job_id").references(() => jobs.id),
  company: text("company"),
  receivedAt: timestamp("received_at"),
  sentAt: timestamp("sent_at"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  accountIdIdx: index("emails_account_id_idx").on(table.accountId),
  directionIdx: index("emails_direction_idx").on(table.direction),
  contactIdIdx: index("emails_contact_id_idx").on(table.contactId),
  jobIdIdx: index("emails_job_id_idx").on(table.jobId),
  receivedAtIdx: index("emails_received_at_idx").on(table.receivedAt),
  messageIdIdx: index("emails_message_id_idx").on(table.messageId),
}));

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

// ========================================
// INTAKE BUILDER MODULE
// ========================================

export const intakes = pgTable("intakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company"), // Company name or tag
  channelType: text("channel_type").notNull().default("web"), // web, phone, other
  active: boolean("active").notNull().default(true),
  defaultPipelineStage: text("default_pipeline_stage").default("lead_intake"),
  defaultContactTags: text("default_contact_tags").array().default(sql`ARRAY[]::text[]`),
  defaultJobTags: text("default_job_tags").array().default(sql`ARRAY[]::text[]`),
  contactMatchBehavior: text("contact_match_behavior").notNull().default("match_or_create"), // match_or_create, always_create
  createJobBehavior: text("create_job_behavior").notNull().default("always"), // always, conditional
  aiInstructions: text("ai_instructions"), // AI behavior instructions for this intake
  webhookToken: text("webhook_token").notNull().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("intakes_name_idx").on(table.name),
  companyIdx: index("intakes_company_idx").on(table.company),
  webhookTokenIdx: index("intakes_webhook_token_idx").on(table.webhookToken),
}));

export const intakeFields = pgTable("intake_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intakeId: varchar("intake_id").notNull().references(() => intakes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  key: text("key").notNull(), // Internal field name
  type: text("type").notNull().default("text"), // text, textarea, phone, email, date, select, multi_select, boolean
  required: boolean("required").notNull().default(false),
  helpText: text("help_text"),
  options: text("options").array().default(sql`ARRAY[]::text[]`), // For select/multi_select
  fieldOrder: integer("field_order").notNull().default(0),
  mappedEntity: text("mapped_entity"), // contact, job, or null
  mappedFieldKey: text("mapped_field_key"), // The actual field on contact/job
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  intakeIdIdx: index("intake_fields_intake_id_idx").on(table.intakeId),
  intakeIdOrderIdx: index("intake_fields_intake_order_idx").on(table.intakeId, table.fieldOrder),
}));

export const intakeSubmissions = pgTable("intake_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intakeId: varchar("intake_id").notNull().references(() => intakes.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  contactId: varchar("contact_id").references(() => contacts.id),
  jobId: varchar("job_id").references(() => jobs.id),
  status: text("status").notNull().default("pending"), // pending, processed, failed
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  intakeIdIdx: index("intake_submissions_intake_id_idx").on(table.intakeId),
  contactIdIdx: index("intake_submissions_contact_id_idx").on(table.contactId),
  statusIdx: index("intake_submissions_status_idx").on(table.status),
  createdAtIdx: index("intake_submissions_created_at_idx").on(table.createdAt),
}));

export const insertIntakeSchema = createInsertSchema(intakes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntake = z.infer<typeof insertIntakeSchema>;
export type Intake = typeof intakes.$inferSelect;

export const insertIntakeFieldSchema = createInsertSchema(intakeFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntakeField = z.infer<typeof insertIntakeFieldSchema>;
export type IntakeField = typeof intakeFields.$inferSelect;

export const insertIntakeSubmissionSchema = createInsertSchema(intakeSubmissions).omit({
  id: true,
  createdAt: true,
});
export type InsertIntakeSubmission = z.infer<typeof insertIntakeSubmissionSchema>;
export type IntakeSubmission = typeof intakeSubmissions.$inferSelect;

// ========================================
// WHATSAPP MESSAGES
// ========================================

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  jobId: varchar("job_id").references(() => jobs.id),
  direction: text("direction").notNull().default("outgoing"), // incoming, outgoing
  fromPhone: text("from_phone").notNull(),
  toPhone: text("to_phone").notNull(),
  body: text("body").notNull(),
  messageSid: text("message_sid"), // Twilio message SID
  conversationId: varchar("conversation_id"), // For grouping messages in a thread
  status: text("status").notNull().default("queued"), // queued, sent, delivered, failed, received
  mediaUrl: text("media_url"),
  mediaContentType: text("media_content_type"),
  templateId: text("template_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  contactIdIdx: index("whatsapp_messages_contact_id_idx").on(table.contactId),
  jobIdIdx: index("whatsapp_messages_job_id_idx").on(table.jobId),
  directionIdx: index("whatsapp_messages_direction_idx").on(table.direction),
  conversationIdIdx: index("whatsapp_messages_conversation_id_idx").on(table.conversationId),
  messageSidIdx: index("whatsapp_messages_message_sid_idx").on(table.messageSid),
  createdAtIdx: index("whatsapp_messages_created_at_idx").on(table.createdAt),
}));

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;

// ========================================
// EVENTS OUTBOX (Neo8Flow Integration)
// ========================================

export const eventsOutbox = pgTable("events_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  idempotencyKey: varchar("idempotency_key").notNull(),
  schemaVersion: varchar("schema_version").notNull().default("1.0"),
  eventType: varchar("event_type").notNull(),
  channel: varchar("channel").notNull(),
  sourceId: varchar("source_id"),
  sourceIp: varchar("source_ip"),
  recordingUrl: varchar("recording_url"),
  leadScore: integer("lead_score"),
  payload: jsonb("payload").notNull(),
  status: varchar("status").notNull().default("pending"),
  dispatchedAt: timestamp("dispatched_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tenantIdempotencyUniqueIdx: uniqueIndex("events_outbox_tenant_idempotency_unique_idx").on(table.tenantId, table.idempotencyKey),
  statusIdx: index("events_outbox_status_idx").on(table.status),
  eventTypeIdx: index("events_outbox_event_type_idx").on(table.eventType),
}));

export const insertEventsOutboxSchema = createInsertSchema(eventsOutbox).omit({
  id: true,
  createdAt: true,
});
export type InsertEventsOutbox = z.infer<typeof insertEventsOutboxSchema>;
export type EventsOutbox = typeof eventsOutbox.$inferSelect;

// ========================================
// AUTOMATION LEDGER (Agent Action Logging)
// ========================================
// Purpose: Immutable record of all agent-triggered mutations
// Single-entry model: One row per action, updated over its lifecycle
// Only state-changing actions are logged (no reads, queries, searches)

export const LedgerMode = {
  DRY_RUN: "dry_run",
  EXECUTED: "executed",
  REJECTED: "rejected",
} as const;
export type LedgerMode = (typeof LedgerMode)[keyof typeof LedgerMode];

export const LedgerStatus = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  FLAGGED: "flagged",
} as const;
export type LedgerStatus = (typeof LedgerStatus)[keyof typeof LedgerStatus];

// Explicit action types - not generic verbs
export const LedgerActionType = {
  CREATE_CONTACT: "create_contact",
  UPDATE_CONTACT: "update_contact",
  DELETE_CONTACT: "delete_contact",
  CREATE_JOB: "create_job",
  UPDATE_JOB: "update_job",
  UPDATE_JOB_STATUS: "update_job_status",
  DELETE_JOB: "delete_job",
  CREATE_ESTIMATE: "create_estimate",
  UPDATE_ESTIMATE: "update_estimate",
  SEND_ESTIMATE: "send_estimate",
  CREATE_INVOICE: "create_invoice",
  UPDATE_INVOICE: "update_invoice",
  SEND_INVOICE: "send_invoice",
  RECORD_PAYMENT: "record_payment",
  SEND_EMAIL: "send_email",
  SEND_SMS: "send_sms",
  PIPELINE_TRANSITION: "pipeline_transition",
  CREATE_APPOINTMENT: "create_appointment",
  UPDATE_APPOINTMENT: "update_appointment",
  DELETE_APPOINTMENT: "delete_appointment",
  CREATE_NOTE: "create_note",
  ASSIGN_TECHNICIAN: "assign_technician",
  // AI Voice Ledger Events (Human Path)
  HUMAN_DISPATCH_INITIATED: "human_dispatch_initiated",
  HUMAN_AUTHORIZATION_CONFIRMED: "human_authorization_confirmed",
  // AI Voice Ledger Events (AI Path - goes through Review Queue)
  AI_PROPOSAL_CREATED: "ai_proposal_created",
  AI_REVIEW_DECISION: "ai_review_decision",
  HUMAN_EXECUTION_DECISION: "human_execution_decision",
  // AI Voice Shared Events
  DISPATCH_SENT: "dispatch_sent",
  EXECUTION_RESULT_RECORDED: "execution_result_recorded",
  // Proposal lifecycle events
  PROPOSAL_REJECTED: "PROPOSAL_REJECTED",
  PROPOSAL_QUEUED: "PROPOSAL_QUEUED",
  PROPOSAL_FAILED: "PROPOSAL_FAILED",
  // Dead-letter / error events
  CALLBACK_ORPHANED: "CALLBACK_ORPHANED",
  EVENT_DEAD_LETTERED: "EVENT_DEAD_LETTERED",
} as const;
export type LedgerActionType = (typeof LedgerActionType)[keyof typeof LedgerActionType];

export const automationLedger = pgTable("automation_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  agentName: text("agent_name").notNull(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  mode: text("mode").notNull().default("dry_run"),
  status: text("status").notNull().default("pending"),
  diffJson: jsonb("diff_json"),
  reason: text("reason"),
  assistQueueId: varchar("assist_queue_id"),
  // P0 HARDENING: Idempotency & Audit Trail
  idempotencyKey: varchar("idempotency_key").unique(), // UUID-based deduplication key
  reasoningSummary: text("reasoning_summary"), // AI decision rationale for forensics
  // Execution tracing
  executionTraceId: varchar("execution_trace_id"), // Links intake → proposal → execution
  // Correlation spine for tracing across systems
  correlationId: varchar("correlation_id"), // Links related events across proposal/dispatch/callback
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  agentNameIdx: index("automation_ledger_agent_name_idx").on(table.agentName),
  actionTypeIdx: index("automation_ledger_action_type_idx").on(table.actionType),
  entityTypeIdx: index("automation_ledger_entity_type_idx").on(table.entityType),
  modeIdx: index("automation_ledger_mode_idx").on(table.mode),
  statusIdx: index("automation_ledger_status_idx").on(table.status),
  timestampIdx: index("automation_ledger_timestamp_idx").on(table.timestamp),
  idempotencyKeyIdx: index("automation_ledger_idempotency_key_idx").on(table.idempotencyKey),
  executionTraceIdx: index("automation_ledger_trace_id_idx").on(table.executionTraceId),
  correlationIdIdx: index("automation_ledger_correlation_id_idx").on(table.correlationId),
}));

export const insertAutomationLedgerSchema = createInsertSchema(automationLedger).omit({
  id: true,
  timestamp: true,
  updatedAt: true,
});
export type InsertAutomationLedger = z.infer<typeof insertAutomationLedgerSchema>;
export type AutomationLedger = typeof automationLedger.$inferSelect;

// ========================================
// AI VOICE DISPATCH LOGS
// ========================================

export const voiceDispatchLogs = pgTable("voice_dispatch_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  contactName: text("contact_name").notNull(),
  intent: text("intent").notNull(),
  contextNotes: text("context_notes"),
  engine: text("engine").notNull().default("economic"), // economic, premium
  status: text("status").notNull().default("pending"), // pending, in_progress, success, failed
  originType: text("origin_type").notNull().default("human"), // human, ai
  summary: text("summary"),
  transcriptUrl: text("transcript_url"),
  ledgerId: varchar("ledger_id").references(() => automationLedger.id),
  dispatchedAt: timestamp("dispatched_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("voice_dispatch_logs_status_idx").on(table.status),
  originTypeIdx: index("voice_dispatch_logs_origin_type_idx").on(table.originType),
  contactIdIdx: index("voice_dispatch_logs_contact_id_idx").on(table.contactId),
  createdAtIdx: index("voice_dispatch_logs_created_at_idx").on(table.createdAt),
}));

export const insertVoiceDispatchLogSchema = createInsertSchema(voiceDispatchLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVoiceDispatchLog = z.infer<typeof insertVoiceDispatchLogSchema>;
export type VoiceDispatchLog = typeof voiceDispatchLogs.$inferSelect;

// ========================================
// DOCUMENT ARTIFACTS (Google Docs, Sheets, etc.)
// ========================================
// Stores document IDs from external services for ActionAI to auto-lookup
// When n8n creates a doc, the callback stores the ID here
// ActionAI can then reference documents by context (contactId, jobId) without manual input

export const documentArtifacts = pgTable("document_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Document identifiers from external service - UNIQUE to prevent duplicates on n8n retries
  documentId: text("document_id").notNull().unique(), // Google Docs/Sheets document ID
  documentUrl: text("document_url"), // Full URL to the document
  title: text("title").notNull(),
  documentType: text("document_type").notNull().default("google_doc"), // google_doc, google_sheet, etc.
  // Context linking - which entity is this doc associated with?
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: "set null" }),
  // Provenance - how was this doc created?
  ledgerId: varchar("ledger_id").references(() => automationLedger.id),
  assistQueueId: varchar("assist_queue_id"),
  createdBy: text("created_by").default("action_ai"), // action_ai, manual, import
  // Metadata
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  documentIdUniqueIdx: uniqueIndex("document_artifacts_document_id_unique_idx").on(table.documentId),
  contactIdIdx: index("document_artifacts_contact_id_idx").on(table.contactId),
  jobIdIdx: index("document_artifacts_job_id_idx").on(table.jobId),
  documentTypeIdx: index("document_artifacts_type_idx").on(table.documentType),
  createdAtIdx: index("document_artifacts_created_at_idx").on(table.createdAt),
}));

export const insertDocumentArtifactSchema = createInsertSchema(documentArtifacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocumentArtifact = z.infer<typeof insertDocumentArtifactSchema>;
export type DocumentArtifact = typeof documentArtifacts.$inferSelect;

// ========================================
// STAGED PROPOSALS (AI Agent Proposal Queue)
// ========================================

export const stagedProposals = pgTable("staged_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, dispatched, dispatch_failed, failed
  actions: jsonb("actions").notNull(), // array of {tool, args}
  reasoning: text("reasoning"),
  riskLevel: text("risk_level"),
  summary: text("summary"),
  relatedEntity: jsonb("related_entity"), // {type, id} or null
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Governance columns from assist_queue migration
  userId: text("user_id"),
  origin: text("origin").notNull().default("ai_chat"), // "voice" | "ai_chat" | "gpt_actions" | "admin_chat" | "webhook"
  userRequest: text("user_request"),
  validatorDecision: text("validator_decision"), // "approve" | "reject"
  validatorReason: text("validator_reason"),
  requiresApproval: boolean("requires_approval").default(true),
  rejectedBy: text("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  escalatedToOperator: boolean("escalated_to_operator").default(false),
  mode: text("mode"), // agentMode at time of creation
  // Correlation spine for tracing across systems
  correlationId: varchar("correlation_id"), // Links proposal → ledger → dispatch → callback
});

export const insertStagedProposalSchema = createInsertSchema(stagedProposals).omit({
  id: true,
  createdAt: true,
});
export type InsertStagedProposal = z.infer<typeof insertStagedProposalSchema>;
export type StagedProposal = typeof stagedProposals.$inferSelect;

/** Standardized structured intent — all AI outputs must conform to this shape */
export type ActionDraft = {
  action: string;
  payload: Record<string, unknown>;
  target?: string;
  targetId?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  reasoning: string;
  requiresApproval: boolean;
};
