
# Google Workspace (Artifact Visibility Hub)

## 1. Purpose
The Workspace tab is the **Cloud File Mirror**. It provides deep links to external documents (Docs, Sheets, Drive) that are contextually linked to CRM records.
It acts as a "Quick Open" launcher for external artifacts, ensuring users don't have to search their Google Drive manually.

## 2. Context Binding Rules (Critical)
The Workspace view is **always scoped** to a parent entity. It never shows a global list of all files.

*   **Primary Context**: **Job** (e.g., Job #9021).
*   **Secondary Context**: **Contact** (e.g., Marcus Vane).
*   **Constraint**: Files shown are **only** those linked to the active entity context.
*   **Visual Indicator**: The UI must always indicate *which* record it is mirroring (e.g., "Context: Job #9021").

## 3. File Association Model
Files are linked via a strict relational triplet in the backend:
*   `entity_type` (Job | Contact | Estimate)
*   `entity_id` (e.g., JOB-9021)
*   `drive_file_id` (Google Drive ID)

**Creation Rule**: Associations are created **outside** this tab (via Jobs, Intake, or Automation).
**Restriction**: Files are **NEVER** manually uploaded or linked inside the Workspace tab. This tab is for consumption/navigation only.

## 4. UI Architecture & Sorting
*   **Context Header**: Clearly identifies the active Job/Contact and sync status.
*   **Artifact Grid**: 3-column layout displaying file cards with metadata.
*   **Default Sorting**:
    1.  `last_activity DESC` (Most recent interaction first).
    2.  `file_name ASC`.
*   **Filters**: Doc, Sheet, Drive Folder, Gmail Record.
*   **External Link**: Clicking any card opens the specific artifact in a new browser tab.

## 5. Empty & Partial States
*   **No Linked Files**:
    *   Message: "No files linked to this record."
    *   CTA: "Files are linked automatically from Jobs or Intake."
    *   *Rationale*: Prevents user from looking for an "Upload" button that doesn't exist.
*   **Filter Returns Zero**:
    *   Message: "No files match this filter."

## 6. User Interaction Flow
1.  **View**: User navigates to Workspace (context is auto-set by the previous screen, e.g., coming from a Job).
2.  **Filter**: User filters by "Sheet" to find the Service Log.
3.  **Action**: User clicks the card.
4.  **Result**: New tab opens `sheets.google.com/...`.

## 7. Backend Expectations
*   **Sync**: Periodic polling of Drive API updates the metadata cache (Last Modified, Owner).
*   **Indexing**: CRM stores a reference ID to the Drive file, not the file binary itself.
*   **Permissions**: The system relies on Google's native permission system. It acts as a pass-through.

## 8. Explicit Non-Goals (Scope Locks)
*   ❌ **No File Editor**: You cannot edit documents here. Edit in Google.
*   ❌ **No Permission Manager**: You cannot share/unshare files here. Manage access in Drive.
*   ❌ **No Uploads**: You cannot upload files here. Upload in Drive, then link via the Job.
*   ❌ **No Folder Navigation**: We do not mirror Drive's directory structure, only a flat list of linked artifacts.

## 9. Edge Cases
*   **403 Error**: If the user lacks Google permission, the link fails in the browser (Google handles the "Request Access" flow). The CRM shows cached metadata only.
*   **Broken Link**: If a file is deleted in Drive, the CRM link breaks. The system flags this as "Orphaned" with a visual warning.
