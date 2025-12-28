# Chat with AI (Discovery & Retrieval)

## 1. Purpose
The Chat with AI interface is a read-only, non-mutating environment designed for deep pipeline discovery, fact retrieval, and compliance cross-referencing. It leverages the Discovery Brain to provide high-fidelity insights without the risk of accidental record mutation or action execution.

## 2. Roles & Permissions
| Role | Action | Access |
| :--- | :--- | :--- |
| **Dispatcher** | Query | Read-only discovery access |
| **Architect** | Query | Read-only discovery access |

## 3. UI Layout
- **Governance Header**: Displays the "Discovery & Retrieval Mode" status and the "Immutable Capability" badge.
- **Message Stream**: Threaded interaction history with timestamping and role identification (Discovery Agent vs. Governance Architect).
- **Governance Lock Alert**: Persistent warning banner confirming the environment is read-only.
- **Restricted Input**: A specialized query bar that allows natural language requests but prevents any command-based action execution.

## 4. User Actions
- **Pipeline Querying**: Requesting breakdowns of lead segments, intent signals, or engagement gaps.
- **Compliance Retrieval**: Cross-referencing internal audit records or legal hold statuses.
- **Fact Verification**: Validating current pipeline state against the global "Truths" defined in AI Settings.

## 5. Governance & Constraints
- **Permanent Read-Only**: The interface is architecturally incapable of triggering outbound dispatches or modifying CRM data.
- **Disabled Actions**: No "Execute", "Submit", or "Update" buttons exist within this context.
- **Query Logging**: All natural language queries are processed through safety filters to ensure retrieval remains within the authorized knowledge scope.

## 6. Data Scope
- **Access**: Full read access to Lead, Deal, Invoice, and Audit data (subject to Role-Based Access Control).
- **Mutation**: 0.0% capability for record updates. Any intent to modify data must be transitioned to the **AI Action Chat** for formal proposal authoring.

## 7. Ledger Impact
- **Retrieval Logs**: High-frequency queries and sensitive data lookups are recorded in the background system logs (though typically omitted from the primary Automation Ledger to reduce noise).
- **Security Events**: Any attempt to bypass retrieval-only constraints is flagged as a governance exception.

## 8. Explicitly Out of Scope
- **Proposal Drafting**: Intent to act must be handled in AI Action Chat.
- **Voice Instruction Authoring**: Handled exclusively in the AI Voice tab.
- **Policy Modification**: Handled in AI Settings.
- **Execution Triggers**: Handled in Ready Execution.