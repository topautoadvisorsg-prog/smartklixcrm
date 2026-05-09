/**
 * Job State Machine Validator
 *
 * Enforces valid job status transitions for field service CRM workflows.
 *
 * Flow:
 * lead_intake → estimate_sent → scheduled → in_progress → completed → invoiced → paid
 *                                    ↓              ↓           ↓
 *                                 cancelled      cancelled   cancelled
 *                                    ↓              ↓
 *                                 on_hold        on_hold → in_progress
 */

export type JobStatus =
  | "lead_intake"
  | "estimate_sent"
  | "scheduled"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "invoiced"
  | "paid";

export interface StateTransition {
  from: JobStatus;
  to: JobStatus;
  allowed: boolean;
  reason?: string;
}

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  lead_intake:    ["scheduled", "cancelled"],
  estimate_sent:  ["scheduled", "cancelled"],
  scheduled:      ["in_progress", "on_hold", "cancelled"],
  in_progress:    ["completed", "on_hold", "cancelled"],
  on_hold:        ["in_progress", "cancelled"],
  completed:      [],        // terminal — invoicing handled via separate Invoice entity
  invoiced:       ["paid"],
  paid:           [],        // terminal
  cancelled:      [],        // terminal
};

export function validateJobTransition(
  currentStatus: string,
  newStatus: string
): StateTransition {
  const from = currentStatus as JobStatus;
  const to = newStatus as JobStatus;

  if (!isValidStatus(from)) {
    return { from, to, allowed: false, reason: `Invalid current status: ${from}` };
  }
  if (!isValidStatus(to)) {
    return { from, to, allowed: false, reason: `Invalid target status: ${to}` };
  }

  const allowedTransitions = VALID_TRANSITIONS[from];
  const allowed = allowedTransitions.includes(to);

  if (!allowed) {
    const isTerminal = allowedTransitions.length === 0;
    return {
      from,
      to,
      allowed: false,
      reason: isTerminal
        ? `Cannot transition from "${from}": it is a terminal state with no further transitions`
        : `Cannot transition from "${from}" to "${to}". Valid: ${allowedTransitions.join(", ")}`,
    };
  }

  return { from, to, allowed: true };
}

export function isValidStatus(status: string): status is JobStatus {
  return status in VALID_TRANSITIONS;
}

export function getValidTransitions(status: JobStatus): JobStatus[] {
  return VALID_TRANSITIONS[status] || [];
}

export function isTerminalState(status: JobStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

export function enforceJobTransition(currentStatus: string, newStatus: string): void {
  const transition = validateJobTransition(currentStatus, newStatus);
  if (!transition.allowed) {
    throw new Error(`Invalid job status transition: ${transition.reason}`);
  }
}
