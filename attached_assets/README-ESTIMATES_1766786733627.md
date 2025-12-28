
# Estimates (Scope, Pricing & Agreements)

## Purpose
The Estimates tab is the **Commercial Agreement Layer**. It facilitates the creation of legally binding Work Breakdown Structures (WBS) and pricing proposals.

## Who Uses This
*   **Estimators/Sales**: To build quotes.
*   **Architects**: To approve discounts or complex scopes.

## What Problem It Solves
*   Standardizes pricing via the Price Book.
*   Tracks the "legal state" of a deal (Sent vs Viewed vs Signed).

## UI Layout & Components
*   **Header**: Status Badge (Human-Controlled Creation), "Email via SendGrid" button, "Convert to Job" button.
*   **Left Pane (Audit & Context)**: 
    *   **Audit Trail**: Vertical timeline of creation and edit events.
    *   **Metadata**: Estimate ID, Client info, Dates.
*   **Right Pane (WBS Builder)**: 
    *   **Grid**: Grouped line items with editable Qty, Rate, Discount.
    *   **Footer**: High-visibility Totals section.
*   **Modals**: SendGrid Dispatch with Email Preview.

## Click-by-Click Behavior
1.  **Add Item**: User clicks "+ Add Line Item". Selects from Price Book.
2.  **Send**: User clicks "Email via SendGrid". Modal opens with template preview. User confirms.
3.  **Convert**: User clicks "Convert to Job". Transition Wizard opens (same as Pipeline).

## Data Inputs & Outputs
*   **Input**: `PriceBook_Item` references, Qty, Discounts.
*   **Output**: PDF Generation, Email Dispatch, `Job` creation.

## Backend Expectations
*   **PDF Generation**: Backend must render HTML estimate to PDF for attachment.
*   **Tracking**: SendGrid webhooks must update status to `Viewed` when pixel fires.

## Edge Cases & Constraints
*   **Locked State**: `Sent` estimates are read-only. Must be "Cloned" or "Revised" to edit.
*   **Negative Values**: Allowed for discounts, but total cannot be negative.

## What This Tab Is NOT
*   ❌ An inventory manager (It reads from Price Book, doesn't decrement stock).
*   ❌ A payment gateway (Payments are recorded in `Payments`).
