import { storage } from "./storage";
import { z } from "zod";

const N8N_WEBHOOK_BASE = process.env.VITE_N8N_WEBHOOK_BASE_URL || "https://smartg23.app.n8n.cloud";

export const createFolderRequestSchema = z.object({
  entityType: z.enum(["contact", "job"]),
  entityId: z.string(),
  entityName: z.string(),
});

export const createFolderResponseSchema = z.object({
  folderId: z.string(),
  folderUrl: z.string(),
});

export type CreateFolderRequest = z.infer<typeof createFolderRequestSchema>;
export type CreateFolderResponse = z.infer<typeof createFolderResponseSchema>;

export async function createDriveFolder(
  request: CreateFolderRequest
): Promise<{ success: boolean; folderId?: string; folderUrl?: string; error?: string }> {
  const webhookPath = "/google-drive/create-folder";
  const webhookUrl = `${N8N_WEBHOOK_BASE}/webhook${webhookPath}`;

  try {
    console.log(`[GoogleDrive] Creating folder for ${request.entityType}:${request.entityId}`);
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entityType: request.entityType,
        entityId: request.entityId,
        entityName: request.entityName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GoogleDrive] Neo8 webhook failed: ${response.status} - ${errorText}`);
      return { success: false, error: `Neo8 returned ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const parsed = createFolderResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error(`[GoogleDrive] Invalid response from Neo8:`, data);
      return { success: false, error: "Invalid response format from Neo8" };
    }

    const { folderId, folderUrl } = parsed.data;

    if (request.entityType === "contact") {
      await storage.updateContact(request.entityId, {
        driveFolderId: folderId,
        driveFolderUrl: folderUrl,
      });
      console.log(`[GoogleDrive] Updated contact ${request.entityId} with folder ${folderId}`);
    } else if (request.entityType === "job") {
      await storage.updateJob(request.entityId, {
        driveFolderId: folderId,
        driveFolderUrl: folderUrl,
      });
      console.log(`[GoogleDrive] Updated job ${request.entityId} with folder ${folderId}`);
    }

    await storage.createAuditLogEntry({
      action: "google_drive.folder_created",
      entityType: request.entityType,
      entityId: request.entityId,
      details: { folderId, folderUrl },
    });

    return { success: true, folderId, folderUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[GoogleDrive] Failed to create folder: ${message}`);
    return { success: false, error: message };
  }
}

export async function createContactFolder(
  contactId: string
): Promise<{ success: boolean; folderId?: string; folderUrl?: string; error?: string }> {
  const contact = await storage.getContact(contactId);
  if (!contact) {
    return { success: false, error: "Contact not found" };
  }

  if (contact.driveFolderId) {
    return { 
      success: true, 
      folderId: contact.driveFolderId, 
      folderUrl: contact.driveFolderUrl || undefined,
      error: "Folder already exists" 
    };
  }

  return createDriveFolder({
    entityType: "contact",
    entityId: contactId,
    entityName: contact.name || `Contact ${contactId}`,
  });
}

export async function createJobFolder(
  jobId: string
): Promise<{ success: boolean; folderId?: string; folderUrl?: string; error?: string }> {
  const job = await storage.getJob(jobId);
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  if (job.driveFolderId) {
    return { 
      success: true, 
      folderId: job.driveFolderId, 
      folderUrl: job.driveFolderUrl || undefined,
      error: "Folder already exists" 
    };
  }

  return createDriveFolder({
    entityType: "job",
    entityId: jobId,
    entityName: job.title || `Job ${job.jobNumber || jobId}`,
  });
}
