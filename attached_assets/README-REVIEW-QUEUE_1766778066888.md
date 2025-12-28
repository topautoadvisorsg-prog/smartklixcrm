
# Review Queue (Master Architect Domain)

## 1️⃣ Purpose
The Review Queue is the **Automated Governance Processing Layer**.
It is the domain of the **Master Architect AI**.

**CRITICAL ARCHITECTURE RULE**:
*   ❌ **NO HUMANS** participate in this queue.
*   ✅ **Master Architect AI** is the ONLY reviewer.

## 2️⃣ What Happens Here
1.  **Input**: Proposals arrive from **ActionAI CRM**.
2.  **Validation**: Master Architect validates logic, schema, and policy compliance.
3.  **Decision**:
    *   **Approved**: Automatically moves to **Ready Execution**.
    *   **Rejected**: Returned to ActionAI CRM for redrafting (or archival).

## 3️⃣ Ledger Responsibility
The Master Architect writes the governance decision to the ledger.
*   **Event Type**: `AI_REVIEW_DECISION`
*   **Actor**: Master Architect (AI)
*   **Content**: Validation outcome, policy check results, and the decision (Approve/Reject).

## 4️⃣ UI Layout & Components
*   **Header**: Status Badge "System Controlled | Read-Only Access".
*   **The Queue (Left Panel)**: Active proposals table.
    *   **Validation Progress**: Visual stepper showing `Logic` -> `Schema` -> `Policy` checks in real-time.
    *   **Status**: Color-coded badges (Green for Approved, Red for Rejected, Amber for In Validation).
*   **Activity Ledger (Right Panel)**: High-frequency stream of system decisions (`AI_REVIEW_DECISION`) providing observability into the automated governance speed.

## 5️⃣ Observability Interface (Optional)
*   **Role**: Passive observability only.
*   **Purpose**: Transparency, debugging, and auditability.
*   **Audience**: Human observers (no authority).
*   **Controls**: None. No interaction, no intervention, no override.
*   **Note**: This interface is optional and may be hidden or disabled in production.

## 6️⃣ The Flow
ActionAI CRM (Propose) -> **Review Queue (Master Architect Validates)** -> Ready Execution (Human Decides)

## 7️⃣ What This Tab Is NOT
*   ❌ A human approval screen (Humans approve in Ready Execution).
*   ❌ A task list for operators.
