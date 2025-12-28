
# AI Settings (Constitution & Configuration Console)

## Purpose
AI Settings is the **System Constitution**. It is the active configuration console where Architects define the purpose, behavior, and constraints of each AI entity.

**This is not a passive status screen.** It is the control room where the "Brains" are tuned.

## Who Uses This
*   **Master Architects**: To define system instructions and autonomy levels.

## What Problem It Solves
*   Centralizes the "System Prompt" management for the entire CRM.
*   Explicitly defines the difference between "Conversational" and "Operational" capability.
*   Provides a kill-switch and throttle for autonomy.

## UI Layout & Components
*   **Left Sidebar (Entity Registry)**: List of AI Entities (Edge Agent, Discovery AI, ActionAI CRM, Master Architect) with status indicators.
*   **Main Stage (Configuration Console)**:
    *   **Core Purpose**: Editable definition of the entity's mandate.
    *   **Behavioral Instructions**: The actual "System Prompt" code editor where personality and priorities are defined (Syntax Highlighted).
    *   **Architectural Hard Constraints**: Grid of toggles for architectural guardrails (often locked).
    *   **Autonomy Throttle**: Segmented control for risk tolerance (Manual vs. Semi-Auto vs. Full-Auto).

## The 4-Entity Architecture (Configurable)
1.  **Edge Agent**: Intake & Triage. *Configurable greeting scripts and data collection rules.*
2.  **Discovery AI**: Retrieval. *Configurable citation strictness and PII masking.*
3.  **ActionAI CRM**: **The System Brain**.
    *   **Dual Role**:
        *   *Headless*: Processes Intake data.
        *   *Interactive*: Processes Chat instructions (via **Action Console**).
    *   *Configurable bias toward action vs. discussion.*
    *   *Configurable autonomy levels (Manual/Semi/Full).*
4.  **Master Architect**: Policy. *Configurable validation schemas.*

## Click-by-Click Behavior
1.  **Select**: Click "ActionAI CRM" in the Entity Registry.
2.  **Edit**: The Console is live. Update the System Prompt to be "More aggressive on closing".
3.  **Refine**: Toggle constraints or adjust the Autonomy Throttle.
4.  **Save**: Click "Save Configuration". Changes propagate to the active Neo8 runtime immediately (Hot Reload).

## Data Inputs & Outputs
*   **Input**: System Instructions (Text), Autonomy State (Enum).
*   **Output**: Live behavior changes in the respective AI agents.

## Backend Expectations
*   **Hot Reload**: Config changes should update the AI context window on the next turn.
*   **Security**: Only Architects can write to this endpoint.

## Edge Cases & Constraints
*   **Locked Constraints**: Some toggles (like "Write Access" for Discovery AI) are architecturally locked and cannot be enabled via UI.

## What This Tab Is NOT
*   ❌ A dashboard.
*   ❌ A role management screen.
