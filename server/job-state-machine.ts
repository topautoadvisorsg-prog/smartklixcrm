/**
 * Job State Machine Validator
 * 
 * Enforces valid job status transitions to prevent invalid state changes.
 * 
 * Agency Workflow State Machine:
 * ```
 * discovery → design → development → review → completed
 *     ↓           ↓           ↓          ↓
 *   cancelled   cancelled   cancelled  cancelled
 * ```
 * 
 * Usage:
 * ```typescript
 * validateJobTransition(currentStatus, newStatus);
 * ```
 */

// ========================================
// STATE MACHINE DEFINITION
// ========================================

export type JobStatus = 
  | "discovery"
  | "design"
  | "development"
  | "review"
  | "completed"
  | "cancelled";

export interface StateTransition {
  from: JobStatus;
  to: JobStatus;
  allowed: boolean;
  reason?: string;
}

// Valid transitions map
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  discovery: ["design", "cancelled"],
  design: ["development", "cancelled"],
  development: ["review", "cancelled"],
  review: ["completed", "cancelled"],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
};

// ========================================
// VALIDATION
// ========================================

/**
 * Validate a job status transition
 * 
 * @param currentStatus - Current job status
 * @param newStatus - Desired new status
 * @returns Transition result with validation status
 * 
 * @example
 * validateJobTransition("lead_intake", "scheduled"); // ✅ Allowed
 * validateJobTransition("lead_intake", "completed"); // ❌ Invalid
 */
export function validateJobTransition(
  currentStatus: string,
  newStatus: string
): StateTransition {
  const from = currentStatus as JobStatus;
  const to = newStatus as JobStatus;

  // Check if statuses are valid
  if (!isValidStatus(from)) {
    return {
      from,
      to,
      allowed: false,
      reason: `Invalid current status: ${from}`,
    };
  }

  if (!isValidStatus(to)) {
    return {
      from,
      to,
      allowed: false,
      reason: `Invalid target status: ${to}`,
    };
  }

  // Check if transition is allowed
  const allowedTransitions = VALID_TRANSITIONS[from];
  const allowed = allowedTransitions.includes(to);

  if (!allowed) {
    return {
      from,
      to,
      allowed: false,
      reason: `Cannot transition from "${from}" to "${to}". Valid transitions: ${allowedTransitions.join(", ") || "none (terminal state)"}`,
    };
  }

  return {
    from,
    to,
    allowed: true,
  };
}

/**
 * Check if a status is valid
 */
export function isValidStatus(status: string): status is JobStatus {
  return status in VALID_TRANSITIONS;
}

/**
 * Get all valid transitions from a status
 */
export function getValidTransitions(status: JobStatus): JobStatus[] {
  return VALID_TRANSITIONS[status] || [];
}

/**
 * Check if a status is a terminal state (no further transitions allowed)
 */
export function isTerminalState(status: JobStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0;
}

// ========================================
// HELPER: Enforce in Storage Layer
// ========================================

/**
 * Wrapper for job update that enforces state machine
 * 
 * Usage in storage.ts:
 * ```typescript
 * async updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined> {
 *   if (job.status) {
 *     const currentJob = await this.getJob(id);
 *     const transition = validateJobTransition(currentJob.status, job.status);
 *     if (!transition.allowed) {
 *       throw new Error(`Invalid job transition: ${transition.reason}`);
 *     }
 *   }
 *   // ... proceed with update
 * }
 * ```
 */
export function enforceJobTransition(
  currentStatus: string,
  newStatus: string
): void {
  const transition = validateJobTransition(currentStatus, newStatus);
  
  if (!transition.allowed) {
    throw new Error(`Invalid job status transition: ${transition.reason}`);
  }
}

// ========================================
// STATE DIAGRAM (for documentation)
// ========================================

/**
 * Job State Machine Diagram
 * 
 * ```
 * Agency Workflow:
 * ```
 * ┌───────────┐
 * │ discovery │
 * └─────┬─────┘
 *       │
 *       ├────────────┐
 *       │            │
 *       ▼            ▼
 * ┌─────────┐  ┌───────────┐
 * │ design  │  │ cancelled │←──────────────┐
 * └────┬────┘  └───────────┘               │
 *      │                                    │
 *      ├────────────┐                        │
 *      │            │                        │
 *      ▼            ▼                        │
 * ┌───────────┐  ┌───────────┐               │
 * │development│  │ cancelled │               │
 * └─────┬─────┘  └───────────┘               │
 *       │                                    │
 *       ├────────────┐                        │
 *       │            │                        │
 *       ▼            ▼                        │
 * ┌───────────┐  ┌───────────┐               │
 * │  review   │  │ cancelled │               │
 * └─────┬─────┘  └───────────┘               │
 *       │                                    │
 *       ├────────────┐                        │
 *       │            │                        │
 *       ▼            ▼                        ▼
 * ┌───────────┐  ┌───────────┐      ┌───────────┐
 * │ completed │  │ cancelled │      │ cancelled │
 * └───────────┘  └───────────┘      └───────────┘
 * ```
 * 
 * Terminal States (no further transitions):
 * - completed
 * - cancelled
 * 
 * Valid Transitions:
 * - discovery → design, cancelled
 * - design → development, cancelled
 * - development → review, cancelled
 * - review → completed, cancelled
 */

// ========================================
// METRICS & MONITORING
// ========================================

export interface JobStateMetrics {
  totalJobs: number;
  byStatus: Record<JobStatus, number>;
  terminalStateCount: number;
  invalidTransitionAttempts: number;
}

/**
 * Track invalid transition attempts for monitoring
 */
let invalidTransitionCount = 0;

export function getInvalidTransitionCount(): number {
  return invalidTransitionCount;
}

export function recordInvalidTransition(): void {
  invalidTransitionCount++;
  console.warn(
    `[Job State Machine] Invalid transition attempted (total: ${invalidTransitionCount})`
  );
}
