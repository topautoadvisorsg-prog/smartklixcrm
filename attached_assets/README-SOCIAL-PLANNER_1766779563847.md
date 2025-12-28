
# Social Media Planner (Workflow-Driven Social Orchestration)

## Purpose
The Social Planner orchestrates **High-Volume Publishing** via Ayrshare. It applies the same governance model (Draft -> Approve -> Publish) to social media.

## Who Uses This
*   **Marketing/Ops**: To draft updates.
*   **Architects**: To approve public messaging.

## What Problem It Solves
*   Prevents brand damage via unapproved posts.
*   Coordinates social updates with CRM events (e.g., "Project Complete").

## UI Layout & Components
*   **Header**: Global "Emergency Pause" control (Red) and Tab Navigation.
*   **Main Dashboard (Planner View)**:
    *   **Calendar (Left)**: Full monthly grid showing scheduled, published, and pending posts with visual status indicators.
    *   **Quick Composer (Top Right)**: Split card with content input and live platform preview (e.g., LinkedIn).
    *   **Approval Queue (Bottom Right)**: Tabbed list of pending posts requiring human sign-off.

## Click-by-Click Behavior
1.  **Draft**: User types content in Composer (Right Panel). Clicks "Schedule for Approval".
2.  **Queue**: Post appears in the `Pending Posts` list (Bottom Right) and as a yellow chip on the Calendar.
3.  **Approve**: Architect clicks "Approve" in the Queue.
4.  **Schedule**: Post status changes to `Scheduled` (Blue) on the Calendar.
5.  **Publish**: At time T, Neo8 calls Ayrshare. Status -> `Published` (Green).

## Data Inputs & Outputs
*   **Input**: Text/Media.
*   **Output**: Ayrshare API calls.

## Backend Expectations
*   **Token Management**: Must handle refreshing OAuth tokens for social platforms.
*   **Rate Limits**: Respect platform API limits.

## Edge Cases & Constraints
*   **Emergency Pause**: Global button stops all scheduled posts instantly.
*   **Platform Specifics**: Character counts vary by platform (X vs LinkedIn).

## What This Tab Is NOT
*   ❌ A community management tool (No replying to comments).
*   ❌ A design tool.
