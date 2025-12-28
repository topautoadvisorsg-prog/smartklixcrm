import { storage } from "./storage";
import { 
  type InsertAutomationLedger, 
  type AutomationLedger,
  LedgerMode,
  LedgerStatus,
  type LedgerActionType 
} from "@shared/schema";

// ========================================
// Automation Ledger Helper
// ========================================
// Purpose: Centralized logging for all agent-triggered mutations
// Rule: ALL mutations must be logged BEFORE execution, updated AFTER
// Single-entry model: One row per action, updated through its lifecycle

// Diff JSON structures for different action types
interface CreateDiff {
  type: "create";
  snapshot: Record<string, unknown>;
}

interface UpdateDiff {
  type: "update";
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

interface DeleteDiff {
  type: "delete";
  snapshot: Record<string, unknown>;
}

interface SendDiff {
  type: "send";
  metadata?: Record<string, unknown>;
}

export type LedgerDiff = CreateDiff | UpdateDiff | DeleteDiff | SendDiff;

// Tool name to action type mapping
// Why: AI tools use snake_case names, we map them to explicit action types
const toolToActionType: Record<string, LedgerActionType> = {
  create_contact: "create_contact",
  update_contact: "update_contact",
  delete_contact: "delete_contact",
  create_job: "create_job",
  update_job: "update_job",
  update_job_status: "update_job_status",
  delete_job: "delete_job",
  create_estimate: "create_estimate",
  update_estimate: "update_estimate",
  send_estimate: "send_estimate",
  create_invoice: "create_invoice",
  update_invoice: "update_invoice",
  send_invoice: "send_invoice",
  record_payment: "record_payment",
  send_email: "send_email",
  send_sms: "send_sms",
  pipeline_transition: "pipeline_transition",
  create_appointment: "create_appointment",
  update_appointment: "update_appointment",
  delete_appointment: "delete_appointment",
  create_note: "create_note",
  assign_technician: "assign_technician",
};

// Entity type extraction from tool name
// Why: Tool names follow pattern like "create_contact" -> entity is "contact"
function extractEntityType(toolName: string): string {
  const parts = toolName.split("_");
  if (parts.length >= 2) {
    return parts.slice(1).join("_");
  }
  return toolName;
}

// Check if a tool is a mutation that should be logged
// Why: Only state-changing actions go in the ledger
export function isMutationTool(toolName: string): boolean {
  return toolName in toolToActionType;
}

// Get action type from tool name
export function getActionType(toolName: string): LedgerActionType | undefined {
  return toolToActionType[toolName];
}

// ========================================
// Ledger Entry Creation (Phase 1: Before Execution)
// ========================================

interface CreateLedgerEntryParams {
  agentName: string;
  toolName: string;
  entityId?: string;
  diffJson?: LedgerDiff;
  assistQueueId?: string;
}

export async function createLedgerEntry(params: CreateLedgerEntryParams): Promise<AutomationLedger> {
  const { agentName, toolName, entityId, diffJson, assistQueueId } = params;
  
  const actionType = getActionType(toolName);
  if (!actionType) {
    throw new Error(`Unknown mutation tool: ${toolName}`);
  }
  
  const entityType = extractEntityType(toolName);
  
  const entry: InsertAutomationLedger = {
    agentName,
    actionType,
    entityType,
    entityId: entityId ?? null,
    mode: LedgerMode.DRY_RUN,
    status: LedgerStatus.PENDING,
    diffJson: diffJson ? JSON.stringify(diffJson) : null,
    assistQueueId: assistQueueId ?? null,
    reason: null,
  };
  
  return await storage.createAutomationLedgerEntry(entry);
}

// ========================================
// Ledger Entry Update (Phase 2: After Execution)
// ========================================

interface UpdateLedgerSuccessParams {
  ledgerId: string;
  entityId: string;
  diffJson?: LedgerDiff;
}

export async function markLedgerSuccess(params: UpdateLedgerSuccessParams): Promise<AutomationLedger | undefined> {
  return await storage.updateAutomationLedgerEntry(params.ledgerId, {
    mode: LedgerMode.EXECUTED,
    status: LedgerStatus.SUCCESS,
    entityId: params.entityId,
    diffJson: params.diffJson ? JSON.stringify(params.diffJson) : undefined,
  });
}

interface UpdateLedgerFailureParams {
  ledgerId: string;
  reason: string;
}

export async function markLedgerFailed(params: UpdateLedgerFailureParams): Promise<AutomationLedger | undefined> {
  return await storage.updateAutomationLedgerEntry(params.ledgerId, {
    mode: LedgerMode.EXECUTED,
    status: LedgerStatus.FAILED,
    reason: params.reason,
  });
}

export async function markLedgerRejected(ledgerId: string, reason?: string): Promise<AutomationLedger | undefined> {
  return await storage.updateAutomationLedgerEntry(ledgerId, {
    mode: LedgerMode.REJECTED,
    status: LedgerStatus.PENDING,
    reason: reason ?? "Rejected by user",
  });
}

export async function markLedgerFlagged(ledgerId: string, reason: string): Promise<AutomationLedger | undefined> {
  return await storage.updateAutomationLedgerEntry(ledgerId, {
    status: LedgerStatus.FLAGGED,
    reason,
  });
}

// ========================================
// Diff Helpers
// ========================================

export function createDiff(snapshot: Record<string, unknown>): CreateDiff {
  return { type: "create", snapshot };
}

export function updateDiff(before: Record<string, unknown>, after: Record<string, unknown>): UpdateDiff {
  return { type: "update", before, after };
}

export function deleteDiff(snapshot: Record<string, unknown>): DeleteDiff {
  return { type: "delete", snapshot };
}

export function sendDiff(metadata?: Record<string, unknown>): SendDiff {
  return { type: "send", metadata };
}

// ========================================
// Query Helpers
// ========================================

export async function getLedgerEntries(filters?: {
  agentName?: string;
  actionType?: string;
  mode?: string;
  status?: string;
  limit?: number;
}): Promise<AutomationLedger[]> {
  return await storage.getAutomationLedgerEntries(filters);
}

export async function getLedgerEntry(id: string): Promise<AutomationLedger | undefined> {
  return await storage.getAutomationLedgerEntry(id);
}
