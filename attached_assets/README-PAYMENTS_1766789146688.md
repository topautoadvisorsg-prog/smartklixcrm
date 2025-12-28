
# Payments (Financial Reconciliation Hub)

## Purpose
The Payments tab is the **Cash Flow Mirror**. It reflects the reality of money movement, syncing with external processors (Stripe) and ledgers (QuickBooks).

## Who Uses This
*   **Accountants/Architects**: For reconciliation.
*   **Dispatchers**: To verify funds before dispatch.

## What Problem It Solves
*   Separates "Quoted" (Estimates) from "Paid" (Payments).
*   Provides a unified view of cash across multiple methods (Cash, Card, ACH).

## UI Layout & Components
*   **Header**: Aggregate Stats (Total Collected).
*   **List View**: Transaction rows (Amount, Method, Status, Date).
*   **Detail Panel**:
    *   **Left**: Customer Link, Processor Metadata.
    *   **Right**: Allocation Links (which Invoice this pays).

## Click-by-Click Behavior
1.  **Inspect**: Click row `PAY-8802`. Detail panel slides in.
2.  **Verify**: Check "Processor Ref" matches Stripe Dashboard.
3.  **Allocations**: See that $2,500 was applied to `INV-9021`.
4.  **Action**: Click "Launcher: NFC Collection" (Mobile) to trigger Stripe Terminal.

## Data Inputs & Outputs
*   **Input**: Webhooks from Stripe/QuickBooks.
*   **Output**: Allocation records (Payment -> Invoice).

## Backend Expectations
*   **Immutability**: Payment records are audit logs. They cannot be edited, only Refunded (new record) or Voided.
*   **Webhook Security**: Must verify signatures from payment providers.

## Edge Cases & Constraints
*   **Unallocated Funds**: A payment can exist without an Invoice link (Overpayment/Retainer).
*   **Disputes**: Status `Disputed` locks the record from allocation.

## What This Tab Is NOT
*   ❌ A bank account.
*   ❌ A place to edit Invoice line items.
