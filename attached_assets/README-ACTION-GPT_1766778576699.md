
# ActionGPT (External Integration Wizard)

## 1️⃣ Purpose
ActionGPT is a **non-operational setup wizard** used to configure external OpenAI Custom GPTs to securely send data into the CRM Intake Hub.

**It is strictly a configuration tool.**
*   It does **NOT** accept manual instructions.
*   It does **NOT** draft proposals.
*   It does **NOT** execute CRM actions.

## 2️⃣ Who Uses This
*   **Architects**: To copy/paste API schemas and generate connection keys for external tools.

## 3️⃣ UI Layout & Components
*   **Header**: Status Badge "System Authority: AI-Native Configuration" and explanatory subtitle.
*   **Step Indicator**: Visual stepper showing the 3 setup phases.
*   **Step 1 (Left Panel)**: **OpenAPI Schema Definition**. Large code viewer with "Copy to Clipboard" functionality.
*   **Step 2 (Right Panel Top)**: **Authentication Credentials**. Masked API Key display and Client ID generation.
*   **Step 3 (Right Panel Bottom)**: **Connectivity Debugger**. JSON payload editor and mock response console for testing ingress connectivity.

## 4️⃣ What This Tab IS NOT
*   ❌ **Action Console**: If you want to instruct the AI manually, go to the **Action Console** tab (ActionAI CRM).
*   ❌ **Drafting Tool**: You cannot type "Draft email" here.
*   ❌ **Chat Interface**: This is a settings screen, not a conversation.

## 5️⃣ Integration Logic
1.  **External Source**: A user talks to a Custom GPT (e.g., in the ChatGPT iOS app).
2.  **API Handoff**: The Custom GPT uses the credentials from this tab to POST data to the CRM.
3.  **Ingress**: Data lands in the **Intake Hub** or **ActionAI CRM (Headless)**.
4.  **Governance**: The internal system takes over.

**No operational work happens inside this tab.**

## 6️⃣ Ingress Contract (Clarified)

### Payload Flexibility
External GPTs may send **arbitrary, free-form input**.
*   **No Schema Enforcement**: Validation is NOT required at the submission edge.
*   **Processing**: All payloads are **Summarized**, **Normalized**, and **Staged** by the Intake Hub.
*   **Safety**: No direct action is ever taken based on raw input. The system treats external data as "untrusted" until normalized.

### Frontend Implication
The ActionGPT tab is a wizard-style configuration screen that helps users connect an external OpenAI Custom GPT.
*   It does **NOT** validate payloads.
*   It does **NOT** preview execution.
*   It does **NOT** restrict what the external GPT sends.
*   It does **NOT** have a chat UI.

All inputs are forwarded to the **Intake Hub** for summarization and downstream AI reasoning.
