
# Contacts (Relationship Context Surface)

## 1️⃣ Purpose & Definition
The Contacts tab is the **Single Source of Truth for Identity**.
It is a **Context Surface**, not a **Work Surface**.

Its sole responsibility is to aggregate and display the "State of the Relationship" by pulling data from the Ledger, Jobs, and Communication modules.

## 2️⃣ Canonical Architecture Rules (The 4 "No's")
To preserve data integrity, the Contacts tab serves as a passive viewer for operational data.
It strictly enforces the following constraints:

1.  ❌ **NO Reasoning**: It does not calculate risk or sentiment (it only displays what Discovery AI has calculated).
2.  ❌ **NO Automation**: It cannot trigger sequences, workflows, or drip campaigns directly.
3.  ❌ **NO Execution**: It cannot charge cards, send invoices, or dispatch technicians.
4.  ❌ **NO Workflow Logic**: It does not track "Stage" or "Pipeline Status" (That lives in the Pipeline).

## 3️⃣ Active Intake Integration (The Outbound Gateway)
While Contacts cannot *process* data, it can **INITIATE** data collection.

### Capability: "Send Intake Request"
Operators may use the Contacts tab to dispatch a structured Intake Form (via Email/SMS/WhatsApp) to a known entity.

### The Canonical Flow
1.  **Contacts Tab**: Operator clicks "Send Intake Request".
2.  **External World**: Client fills out the form.
3.  **Intake Hub**: Raw response arrives here. **(Contacts tab is bypassed)**.
4.  **Intake Hub**: Data is Normalized & Staged.
5.  **Intake Hub**: Operator performs "Verify & Commit".
6.  **ActionAI CRM**: Receives payload and proposes updates to the Contact Record.

**Constraint**: The Contacts tab **NEVER** processes the return signal. All updates return via the Intake Hub -> ActionAI loop.

## 4️⃣ Ledger Relationship (Read-Only Mirror)
The Contacts tab acts as a **Read-Only Viewport** into the Automation Ledger.

*   **Financial Aggregates**: "Total Revenue" is a calculated sum of `PAYMENT_SETTLED` events from the Ledger. The Contacts tab cannot edit this number.
*   **Job History**: Displays a filtered list of Jobs linked to this Identity.
*   **Immutability**: A user cannot "delete" a Job or "edit" an Invoice from the Contacts screen. They must navigate to the source authority (Jobs or Payments tab) to propose changes.

**The Ledger is the Single Source of Truth.** Contacts is merely a reflection.

## 5️⃣ AI Signal Ownership (Discovery AI)
Metric visualizations such as **"Warmth Score"** or **"Churn Risk"** are displayed on the profile.

*   **Owner**: **Discovery AI**.
*   **Nature**: Read-Only / Advisory.
*   **Editability**: **Locked**. A human cannot manually adjust the "Warmth Score". It is a derived metric based on interaction frequency and sentiment analysis logged in the Ledger.

## 6️⃣ Allowed Actions (Strictly Scoped)
The following actions are permissible within this tab:
*   ✅ **Navigation**: "Jump to Job", "Jump to Action Console".
*   ✅ **Inspection**: Viewing history, logs, and files.
*   ✅ **Static Edits**: Updating Phone, Email, or Address (Identity Mutation).
*   ✅ **Initiation**: Triggering an "Active Intake" request.

## 7️⃣ UI Layout & Components
*   **Navigation Rail (Left)**: Searchable list of contacts with status indicators.
*   **Main Detail Grid (3-Column Layout)**:
    *   **Identity (Editable)**: Core form fields (Name, Phone, Address) with "Save" capability.
    *   **Signals (Read-Only)**: Visual gauges for Warmth, Churn Risk, and Sentiment (Owned by Discovery AI).
    *   **Ledger (Read-Only)**: Lifetime Revenue display and Job History list.

## 8️⃣ What This Tab Is NOT
*   ❌ **Action Console**: You cannot "Ask AI to draft an email" here. Navigate to `Action Chat`.
*   ❌ **Pipeline**: You cannot move a deal stage here. Navigate to `Pipeline`.
*   ❌ **Inbox**: You cannot reply to an SMS here. Navigate to `WhatsApp` or `Email`.
