/**
 * Validator Function - Policy Agent
 * 
 * Simple stateless decision function that validates proposed actions
 * before they are sent to external execution systems (OpenClaw).
 * 
 * Flow: Input → Validator → {decision, reason} → Done
 * 
 * This is NOT a system, orchestrator, or state machine.
 * It's a pure function that makes yes/no decisions.
 */

import { z } from "zod";

// Input schema for validation proposals
export const validationProposalSchema = z.object({
  action: z.string().describe("Action type: create_contact, update_job, send_email, etc."),
  target: z.string().describe("Target entity: contact, job, invoice, etc."),
  targetId: z.string().optional().describe("Target entity ID (if updating existing)"),
  summary: z.string().describe("Human-readable summary of what will happen"),
  payload: z.record(z.unknown()).describe("Structured payload with action details"),
  reasoning: z.string().optional().describe("Why this action is being proposed"),
  requestedBy: z.string().describe("Who/what requested this action: user, ai, webhook, etc."),
});

export type ValidationProposal = z.infer<typeof validationProposalSchema>;

// Decision output schema
export const validationDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]).describe("approve or reject"),
  reason: z.string().describe("Clear explanation of why approved or rejected"),
  riskLevel: z.enum(["low", "medium", "high"]).describe("Risk assessment"),
  requiresHumanApproval: z.boolean().describe("Whether human must approve before execution"),
  suggestedModifications: z.array(z.string()).optional().describe("Suggested changes if rejected"),
});

export type ValidationDecision = z.infer<typeof validationDecisionSchema>;

// Validation rules
const VALIDATION_RULES = {
  // High-risk actions always require human approval
  highRiskActions: [
    "delete_contact",
    "delete_job",
    "delete_invoice",
    "refund_payment",
    "update_payment_amount",
  ],

  // Medium-risk actions
  mediumRiskActions: [
    "update_contact_email",
    "update_contact_phone",
    "create_invoice",
    "send_email",
    "send_sms",
    "update_job_status",
  ],

  // Low-risk actions (can be auto-approved)
  lowRiskActions: [
    "create_contact",
    "add_note",
    "view_contact",
    "view_job",
    "search_contacts",
    "get_dashboard_stats",
  ],

  // Required fields for specific actions
  requiredFields: {
    create_contact: ["name", "email"],
    update_contact: ["targetId", "payload"],
    create_job: ["contactId", "title"],
    create_invoice: ["jobId", "amount"],
    send_email: ["contactId", "subject", "body"],
    send_sms: ["contactId", "message"],
  },
};

/**
 * Main validation function
 * 
 * @param proposal - The action proposal to validate
 * @returns Validation decision with reason
 */
export function reviewProposal(proposal: ValidationProposal): ValidationDecision {
  try {
    // Validate input schema
    const validated = validationProposalSchema.parse(proposal);

    // Determine risk level
    const riskLevel = assessRiskLevel(validated.action);

    // Check if action requires human approval
    const requiresHumanApproval = requiresHumanApprovalCheck(validated.action, riskLevel);

    // Validate required fields
    const fieldValidation = validateRequiredFields(validated);
    if (!fieldValidation.valid) {
      return {
        decision: "reject",
        reason: fieldValidation.reason,
        riskLevel,
        requiresHumanApproval: false,
        suggestedModifications: fieldValidation.suggestions,
      };
    }

    // Apply business rules
    const businessRuleCheck = applyBusinessRules(validated);
    if (!businessRuleCheck.approved) {
      return {
        decision: "reject",
        reason: businessRuleCheck.reason,
        riskLevel,
        requiresHumanApproval,
        suggestedModifications: businessRuleCheck.suggestions,
      };
    }

    // Approve
    return {
      decision: "approve",
      reason: `Action "${validated.action}" approved. ${requiresHumanApproval ? "Requires human confirmation before execution." : "Can proceed automatically."}`,
      riskLevel,
      requiresHumanApproval,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        decision: "reject",
        reason: `Invalid proposal format: ${error.errors.map(e => e.message).join(", ")}`,
        riskLevel: "low",
        requiresHumanApproval: false,
        suggestedModifications: ["Ensure proposal matches required schema"],
      };
    }
    
    return {
      decision: "reject",
      reason: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      riskLevel: "high",
      requiresHumanApproval: true,
    };
  }
}

/**
 * Assess risk level of an action
 */
function assessRiskLevel(action: string): "low" | "medium" | "high" {
  const normalizedAction = action.toLowerCase().trim();

  if (VALIDATION_RULES.highRiskActions.includes(normalizedAction)) {
    return "high";
  }

  if (VALIDATION_RULES.mediumRiskActions.includes(normalizedAction)) {
    return "medium";
  }

  if (VALIDATION_RULES.lowRiskActions.includes(normalizedAction)) {
    return "low";
  }

  // Default to medium for unknown actions
  return "medium";
}

/**
 * Check if action requires human approval
 */
function requiresHumanApprovalCheck(action: string, riskLevel: "low" | "medium" | "high"): boolean {
  // High risk always requires human approval
  if (riskLevel === "high") {
    return true;
  }

  // Medium risk requires human approval
  if (riskLevel === "medium") {
    return true;
  }

  // Low risk can be auto-approved
  return false;
}

/**
 * Validate required fields are present
 */
function validateRequiredFields(proposal: ValidationProposal): {
  valid: boolean;
  reason: string;
  suggestions?: string[];
} {
  const normalizedAction = proposal.action.toLowerCase().trim();
  const requiredFields = (VALIDATION_RULES.requiredFields as Record<string, string[]>)[normalizedAction];

  if (!requiredFields) {
    // No specific requirements for this action
    return { valid: true, reason: "" };
  }

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    // Check if field exists in payload or as top-level property
    const hasField = field in proposal.payload || 
                     (field === "targetId" && proposal.targetId) ||
                     (field in proposal);

    if (!hasField) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      reason: `Missing required fields: ${missingFields.join(", ")}`,
      suggestions: [`Add the following fields: ${missingFields.join(", ")}`],
    };
  }

  return { valid: true, reason: "" };
}

/**
 * Apply business rules validation
 */
function applyBusinessRules(proposal: ValidationProposal): {
  approved: boolean;
  reason: string;
  suggestions?: string[];
} {
  const { action, summary, payload } = proposal;

  // Rule 1: Summary must be descriptive
  if (!summary || summary.length < 10) {
    return {
      approved: false,
      reason: "Summary is too brief. Must be at least 10 characters.",
      suggestions: ["Provide a clear, descriptive summary of what this action will do"],
    };
  }

  // Rule 2: Payload must not be empty for actions that modify data
  if (["create", "update", "delete", "send"].some(keyword => action.toLowerCase().includes(keyword))) {
    if (!payload || Object.keys(payload).length === 0) {
      return {
        approved: false,
        reason: `Action "${action}" requires a non-empty payload with action details.`,
        suggestions: ["Add structured payload with all necessary action parameters"],
      };
    }
  }

  // Rule 3: Email actions must have valid email format
  if (action.toLowerCase().includes("email") && payload.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(payload.email))) {
      return {
        approved: false,
        reason: "Invalid email format in payload.",
        suggestions: ["Ensure email field contains a valid email address"],
      };
    }
  }

  // Rule 4: Phone actions must have valid phone format
  if (action.toLowerCase().includes("sms") && payload.phone) {
    const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
    if (!phoneRegex.test(String(payload.phone))) {
      return {
        approved: false,
        reason: "Invalid phone number format in payload.",
        suggestions: ["Ensure phone field contains a valid phone number"],
      };
    }
  }

  // All rules passed
  return { approved: true, reason: "" };
}

/**
 * Helper: Create a validation proposal from raw input
 */
export function createProposal(input: {
  action: string;
  target: string;
  targetId?: string;
  summary: string;
  payload: Record<string, unknown>;
  reasoning?: string;
  requestedBy: string;
}): ValidationProposal {
  return {
    action: input.action,
    target: input.target,
    targetId: input.targetId,
    summary: input.summary,
    payload: input.payload,
    reasoning: input.reasoning || `Automated proposal for ${input.action}`,
    requestedBy: input.requestedBy,
  };
}
