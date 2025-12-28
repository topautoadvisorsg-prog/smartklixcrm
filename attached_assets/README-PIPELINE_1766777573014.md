
# Pipeline (Revenue Forecasting & Transition Gate)

## Purpose
The Pipeline is the **Booking-First State Machine**. It governs the lifecycle of revenue opportunities from "New Request" to "Booked Job". It enforces strict governance gates before a lead can become an operational job.

## Product Intent
*   **Booking is Irreversible**: Once a job is booked, it leaves the opportunity pipeline and enters the `Jobs` operational queue.
*   **Prevent Phantom Revenue**: Strictly defines stage exit criteria (e.g., Active Estimate required for Approval).
*   **Operator Authority**: Sales staff can nurture leads, but only Operators can finalize bookings.

## Fixed Stages (Non-Configurable)
1.  **New Request** (Weight: 0%)
2.  **Qualification** (Weight: 25%)
3.  **Negotiation** (Weight: 50%)
4.  **Approved** (Weight: 90% - Gate)
5.  **Booked** (Weight: 100% - Locked)

## UI Layout & Components
*   **Velocity Dashboard (Header)**:
    *   **Total Weighted Forecast**: Large central display of the current pipeline value.
    *   **Velocity Bar**: A multi-colored segmented progress bar visualizing the value distribution across stages.
    *   **Role Indicator**: Top-right toggle showing current authority level (Operator vs Sales).
*   **Kanban Board**:
    *   **Columns**: Strictly defined stages with visual indicators for Gates (Dashed/Texture) and Locks (Padlock Icon).
    *   **Cards**: Minimalist dark cards with color-coded left borders matching their stage.
    *   **Alerts**: Embedded warning blocks (e.g., "Missing Active Estimate") preventing forward movement.
*   **Transition Wizard (Modal)**:
    *   Intercepts the `Approved` -> `Booked` action.
    *   Glassmorphism overlay displaying "Step X of 4".
    *   Requires explicit "COMMIT BOOKING" action to trigger the ledger event.

## UI State Update Rules
*   All stage transitions **EXCEPT** `Approved → Booked` use optimistic UI updates.
*   The `Approved → Booked` transition is **non-optimistic** and only occurs after successful completion of the Conversion Wizard and backend confirmation.
*   On backend rejection, the UI must rollback the card and display an error toast.

## Forecast Calculation
Total Forecast Value is calculated as:
```math
SUM(
  Qualification cards × 0.25 +
  Negotiation cards × 0.50 +
  Approved cards × 0.90 +
  Booked cards × 1.00
)
```
Only the **Active Estimate** value is used per card.

## Role-Based Permissions
| Role | Permissions | UI Behavior |
| :--- | :--- | :--- |
| **Sales / Estimator** | Move cards up to `Approved` | Drag handle disabled for `Approved` cards. |
| **Operator** | Can complete `Booked` transition | Full access. |

## Valid Transitions
*   **Forward**: Linear (`New` -> `Qual` -> `Neg` -> `Appr`).
*   **Backward**:
    *   `Approved → Negotiation`
    *   `Approved → Qualification`
    *   `Negotiation → Qualification`
    *   *Note: Backward transitions do NOT reverse ledger history; they only change the current pipeline state.*
*   **Gated**: `Approved` -> `Booked` is **intercepted** by the Conversion Wizard.
*   **Blocked**: No moving out of `Booked`. No skipping stages (e.g., `New` -> `Approved` is illegal).

## Conversion Wizard (Mandatory Gate)
Triggered when dragging a card to `Booked`.
*   **Step 1 (Data)**: Validate Contact Info (Phone/Email).
*   **Step 2 (Scope)**: Confirm Active Estimate (Read-only view of `Estimates` data).
*   **Step 3 (Ops)**: Assign Technician & Duration.
*   **Step 4 (Finance)**: Verify Deposit / Payment Readiness.

**Action**: "Commit Booking" creates the `Job` record via backend command and moves the card to `Booked`.

### Cancellation Behavior
*   If the Conversion Wizard is closed or cancelled:
    *   The card remains in `Approved`.
    *   No `Job` is created.
    *   No booking ledger event is emitted.

## Estimate Rules
*   A card **MUST** have `hasActiveEstimate: true` to move from `Negotiation` to `Approved`.
*   If no estimate exists, the UI blocks the drop and shows a warning.

## Ledger Events (Backend Emitted)
The frontend does not write to the ledger directly. Backend emits these immutable events on state change:
*   `PIPELINE_STAGE_CHANGED`: `{ trace_id, previous_stage, next_stage, actor_id }`
*   `PIPELINE_BOOKING_ATTEMPTED`: `{ trace_id, actor_id }`
*   `PIPELINE_BOOKING_COMMITTED`: `{ trace_id, job_id, value }`
*   `PIPELINE_BOOKING_REJECTED`: `{ trace_id, reason }`

## Backend Expectations
*   **State Machine**: Backend rejects invalid transitions (returns 400 Bad Request).
*   **Job Creation**: The `Commit Booking` action triggers the `CreateJob` command in the `Jobs` context.
*   **Webhooks**: Stage changes trigger SendGrid emails (e.g., "Thanks for your interest").

### Job Creation Failure
*   If Job creation fails after `Commit Booking`:
    *   Card remains in `Approved`.
    *   `PIPELINE_BOOKING_REJECTED` is emitted.
    *   UI displays an error and allows retry.

## Visual Governance Indicators
*   🔒 **Lock Icon**: On `Booked` cards.
*   ⚠️ **Warning**: On cards in `Negotiation` without an Estimate.
*   ⛔ **Disabled Drag**: For unauthorized roles.
*   **Opacity**: 50% for Stale cards (>30 days).

## What This Tab Is NOT
*   ❌ A billing system (Use `Payments`).
*   ❌ A job scheduler (Use `Jobs`).
*   ❌ A place to edit Estimate line items (Use `Estimates`).
