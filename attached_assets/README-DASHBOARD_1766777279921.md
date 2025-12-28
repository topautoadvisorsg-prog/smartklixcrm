
# Dashboard (Operational Snapshot Hub)

## Purpose
The Dashboard serves as the **Read-Only Situational Awareness Layer**. Its sole purpose is to answer the question: "Is the business healthy right now?" within 5 seconds of login. It aggregates high-level metrics and alerts but performs zero data mutation.

## Who Uses This
*   **Executives/Owners**: For revenue forecasting and high-level activity monitoring.
*   **Dispatchers**: To identify immediate bottlenecks (e.g., "Awaiting Review" count).
*   **Technicians**: N/A (Technicians live in Jobs/Mobile view).

## What Problem It Solves
*   Eliminates "tab fatigue" by surfacing critical alerts (e.g., "8 Proposals Stuck in Review") immediately.
*   Provides a visual heartbeat of the system without requiring deep dives into the Ledger.

## UI Layout & Components
*   **Header**: Global Status Bar with timestamp of last data fetch and "Read-Only View" indicator.
*   **KPI Bento Grid (Top)**: 4 Cards (Active Missions, Awaiting Review, Completion Rate, Pipeline Value).
*   **Middle Section**:
    *   **Activity Volume Graph (Left)**: 24h Bar chart visualizing system throughput (Neo8 events).
    *   **Insights Panel (Right)**:
        *   **Discovery Insights**: AI-derived bullet points highlighting stale leads or anomalies (Purple).
        *   **Next Mission**: High-priority scheduled item details (Amber).
*   **Recent Activity Feed (Bottom)**: Chronological list of the last 4 Ledger entries with status indicators and direct links to the Ledger.

## Click-by-Click Behavior
1.  **KPI Cards**: Clicking a card (e.g., "Awaiting Review") navigates directly to the relevant tab (e.g., `Review Queue`).
2.  **Refresh**: Clicking the timestamp in the header triggers a re-fetch of cached stats.
3.  **Discovery Insights**: Clicking an insight performs a deep-link query to `Read Chat` to expand on the data.
4.  **Activity Feed**: Clicking a row navigates to the specific `Automation Ledger` entry.

## Data Inputs & Outputs
*   **Input**: Aggregated JSON stats object from `Neo8_Analytics_Service`.
*   **Output**: Navigation events (Client-side routing).

## Backend Expectations
*   **Caching**: Data is cached for 60s to prevent DB hammering.
*   **Permissions**: Read-Only access to all modules.
*   **Latency**: Must render < 500ms.

## Edge Cases & Constraints
*   **Zero Data**: If system is new, displays "System Initializing" skeletons.
*   **API Failure**: Shows "Stale Data" warning banner if cache is > 5 mins old.

## What This Tab Is NOT
*   ❌ An execution surface (No buttons trigger workflows).
*   ❌ A report builder (Layout is fixed/bento).
*   ❌ A real-time monitor (It is a polled snapshot).
