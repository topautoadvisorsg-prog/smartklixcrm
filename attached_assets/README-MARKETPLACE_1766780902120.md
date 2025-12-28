
# Marketplace (Integration & Read-Only Data Hub)

## Purpose
The Marketplace is the **Connectivity Switchboard**. It authorizes Neo8 to talk to external tools via Zapier/Relay.

## Who Uses This
*   **Architects**: To connect/disconnect apps.

## What Problem It Solves
*   Centralizes API key/token management.
*   Visualizes connection health.

## UI Layout & Components
*   **Sidebar**: Categories (Finance, Communication).
*   **Grid**: App Cards (Logo, Status, Connect Button).
*   **Modal**: "Connect Wizard" (OAuth flow).

## Click-by-Click Behavior
1.  **Select**: Click "Stripe".
2.  **Connect**: Click "Connect". Modal opens.
3.  **Auth**: User performs OAuth handshake.
4.  **Active**: Status changes to `Connected`. Neo8 begins sync.

## Data Inputs & Outputs
*   **Input**: OAuth Tokens.
*   **Output**: Active Integration objects.

## Backend Expectations
*   **Security**: Tokens stored in Vault/Secrets Manager, never exposed to FE.
*   **Status Checks**: Periodic pings to verify token validity.

## Edge Cases & Constraints
*   **Disconnect**: Revokes token. Stops all associated workflows.
*   **Error**: Visual indicator if sync fails.

## What This Tab Is NOT
*   ❌ A data editor (You don't edit Stripe data here).
*   ❌ A workflow builder (Use `Funnels`).
