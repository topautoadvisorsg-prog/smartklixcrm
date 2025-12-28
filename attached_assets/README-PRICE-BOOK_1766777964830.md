
# Price Book (Revenue Control & Operational SSOT)

## Purpose
The Price Book is the **Business Physics Engine**. It is the Single Source of Truth for all SKUs, Services, Labor Rates, and Materials. It protects margin by centralizing pricing logic.

## Who Uses This
*   **Architects**: To set prices and margins.
*   **Sales/Techs**: To lookup items (Read-Only).

## What Problem It Solves
*   Prevents "maverick spend" and "made-up pricing" by field staff.
*   Ensures consistent naming and tax coding across all jobs.

## UI Layout & Components
*   **Sidebar**: Category Tree (Services > HVAC, Materials, Labor). Filter controls at bottom.
*   **Main View**:
    *   **Admin Grid**: Detailed table with columns for Cost, Price, Margin % (color-coded), and Status.
    *   **Visual Catalog**: Card-based view for field presentation.
*   **Floating Item Editor**: A modal dialog for editing item details (Identity, Financials, Media).

## Click-by-Click Behavior
1.  **Navigation**: Click "HVAC" category -> Filter grid.
2.  **Edit**: Click row. Floating Editor opens. Update "Internal Cost". Auto-calc "Margin". Save.
3.  **Privacy**: Toggle "Privacy Mode" to hide Cost/Margin columns (for showing client screen).
4.  **Provision**: Click "+ Provision Item" to add new SKU.

## Data Inputs & Outputs
*   **Input**: SKU details, Cost, Markups.
*   **Output**: `PriceBook_Item` records available to Estimates.

## Backend Expectations
*   **Versioning**: Price changes should ideally version the item so historical estimates remain accurate.
*   **Sync**: Updates here may push to QuickBooks/Xero via Marketplace.

## Edge Cases & Constraints
*   **Deletion**: Items in use cannot be deleted, only Archived.
*   **Zero Price**: Allowed for "TBD" items, but flagged.

## What This Tab Is NOT
*   ❌ A stock controller (No quantity-on-hand tracking).
*   ❌ A purchase order system.
