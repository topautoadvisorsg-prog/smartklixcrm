
# WhatsApp Module (Operational Messaging Engine)

## Purpose
The WhatsApp tab is the **Instant Operations Channel**. It manages high-velocity, low-latency communication for logistics and field coordination.

## Who Uses This
*   **Dispatchers**: To guide technicians and update clients.
*   **Technicians** (via Mobile): To check in.

## What Problem It Solves
*   Handles the "24-hour Session" constraint imposed by Meta.
*   Centralizes fragmented chat logs.

## UI Layout & Components
*   **Triage Rail (Left)**: Conversations sorted by Urgency.
*   **Chat Stream (Center)**: Bubble view. "Session Active/Expired" indicator.
*   **Context Deck (Right)**: Identity, Active Job, AI Analysis.
*   **Template Modal**: For re-engaging expired sessions.

## Click-by-Click Behavior
1.  **Select**: Click conversation `Marcus Vane`.
2.  **Chat**: Type "Dave is arriving". Click Send.
3.  **Expired**: If session expired, input is locked. Click "Send Template". Select "Appointment Reminder". Send.
4.  **Context**: Click "Active Dispatch" in right rail to jump to `Jobs` tab.

## Data Inputs & Outputs
*   **Input**: WhatsApp Webhooks (Inbound).
*   **Output**: Outbound messages/templates via Meta API.

## Backend Expectations
*   **Session Timer**: Backend must track the 24h window from the last *user* message.
*   **Media**: Must handle image/pdf bridging.

## Edge Cases & Constraints
*   **Template Rejection**: If Meta rejects a template, UI shows "Failed".
*   **Rate Limits**: High volume sends may be queued.

## What This Tab Is NOT
*   ❌ A marketing blaster (No bulk spam).
*   ❌ A bot builder (Logic is in `Funnels` or `AI Voice`).
