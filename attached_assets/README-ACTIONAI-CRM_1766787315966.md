
# ActionAI CRM (Dual-Role Brain)

## 1️⃣ Definition & Responsibility
ActionAI CRM is the **System Brain**. It is responsible for reasoning, decision-making, and drafting operational proposals.
It has one responsibility: **To propose governed actions based on input.**

It is **NOT** a background-only service. It has two explicit interfaces.

## 2️⃣ The Two Input Paths (Dual Role)

### A) The Headless Engine (Automated)
*   **Input Source**: `Intake Hub`, `Funnels`.
*   **Trigger**: Data is committed (e.g., Form Submission, Webhook).
*   **Behavior**: ActionAI analyzes the payload, deduplicates, and generates a proposal.
*   **Output**: Review Queue (for Master Architect AI).

### B) The Action Console (Interactive)
*   **Input Source**: `Action Console` (Tab).
*   **Trigger**: Operator types a manual instruction (e.g., "Draft an invoice for Marcus").
*   **Behavior**: ActionAI interprets the intent, queries context, and drafts a proposal.
*   **Output**: Review Queue (for Master Architect AI).

**Critical Rule**: Both paths lead to the **Same Outcome** (A proposal in the Review Queue).

## 3️⃣ Ledger Responsibility (The First Link)
ActionAI is the **First Writer** in the chain of custody.
*   **When**: Immediately upon generating a draft.
*   **Writes**: `AI_PROPOSAL_CREATED`.
*   **Contains**: The raw intent and the generated JSON payload.

## 4️⃣ Capability Contract (Allowed Actions)
ActionAI CRM is authorized to **PROPOSE** the following actions only:
1.  **Create Lead**: From normalized intake data.
2.  **Create Contact**: Maximum of **5** entities per proposal.
3.  **Create Task**: Follow-up tasks for human operators.
4.  **Draft Communication**: Email, SMS, or WhatsApp drafts.
5.  **Create Note**: Internal context logging.
6.  **Create Job**: Only if explicitly allowed by Master Architect policy.

## 5️⃣ Hard Constraints (Prohibited Actions)
ActionAI CRM is strictly **FORBIDDEN** from:
*   ❌ **Direct Mutation**: Cannot update existing records autonomously.
*   ❌ **Overwrite**: Cannot change data it created without human approval.
*   ❌ **Direct Execution**: Cannot send emails or money.
*   ❌ **Bypass**: Cannot skip the Review Queue or Master Architect.

## 6️⃣ Failure Policy (The 3-Strike Rule)
To prevent loops and hallucinations, the system enforces a strict kill-switch:
1.  **First Failure**: Master Architect rejects proposal. ActionAI requests redraft.
2.  **Second Failure**: Master Architect rejects proposal. ActionAI requests redraft.
3.  **Third Failure**: **BLOCK**.
    *   ActionAI CRM is suspended for this specific context/task.
    *   The task reverts to **Manual Handling Only**.
    *   Event is logged as "AI Unfit for Task".
