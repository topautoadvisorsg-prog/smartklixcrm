import { toast } from "@/hooks/use-toast";

export const showSuccessToast = (title: string, description?: string) => {
  toast({
    title,
    description,
    variant: "default",
  });
};

export const showErrorToast = (title: string, description?: string) => {
  toast({
    title,
    description,
    variant: "destructive",
  });
};

export const crudToasts = {
  contact: {
    created: (name: string) =>
      showSuccessToast("Contact Created", `${name} has been added to your contacts`),
    updated: (name: string) =>
      showSuccessToast("Contact Updated", `${name} has been updated successfully`),
    deleted: (name: string) =>
      showSuccessToast("Contact Deleted", `${name} has been removed from your contacts`),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} contact. Please try again.`),
  },
  job: {
    created: (title: string) =>
      showSuccessToast("Job Created", `${title} has been created successfully`),
    updated: (title: string) =>
      showSuccessToast("Job Updated", `${title} has been updated successfully`),
    deleted: (title: string) =>
      showSuccessToast("Job Deleted", `${title} has been removed`),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} job. Please try again.`),
  },
  estimate: {
    created: () =>
      showSuccessToast("Estimate Created", "New estimate has been created successfully"),
    updated: () =>
      showSuccessToast("Estimate Updated", "Estimate has been updated successfully"),
    deleted: () =>
      showSuccessToast("Estimate Deleted", "Estimate has been removed"),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} estimate. Please try again.`),
  },
  invoice: {
    created: (invoiceNumber?: string) =>
      showSuccessToast(
        "Invoice Created",
        invoiceNumber ? `Invoice ${invoiceNumber} has been created` : "New invoice has been created"
      ),
    updated: (invoiceNumber?: string) =>
      showSuccessToast(
        "Invoice Updated",
        invoiceNumber ? `Invoice ${invoiceNumber} has been updated` : "Invoice has been updated"
      ),
    deleted: (invoiceNumber?: string) =>
      showSuccessToast(
        "Invoice Deleted",
        invoiceNumber ? `Invoice ${invoiceNumber} has been removed` : "Invoice has been removed"
      ),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} invoice. Please try again.`),
  },
  payment: {
    created: (amount?: string) =>
      showSuccessToast(
        "Payment Recorded",
        amount ? `Payment of ${amount} has been recorded` : "Payment has been recorded successfully"
      ),
    updated: () =>
      showSuccessToast("Payment Updated", "Payment has been updated successfully"),
    deleted: () =>
      showSuccessToast("Payment Deleted", "Payment record has been removed"),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} payment. Please try again.`),
  },
  appointment: {
    created: (title: string) =>
      showSuccessToast("Appointment Scheduled", `${title} has been scheduled`),
    updated: (title: string) =>
      showSuccessToast("Appointment Updated", `${title} has been updated`),
    deleted: (title: string) =>
      showSuccessToast("Appointment Cancelled", `${title} has been cancelled`),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} appointment. Please try again.`),
  },
  note: {
    created: () =>
      showSuccessToast("Note Added", "Note has been saved successfully"),
    updated: () =>
      showSuccessToast("Note Updated", "Note has been updated successfully"),
    deleted: () =>
      showSuccessToast("Note Deleted", "Note has been removed"),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} note. Please try again.`),
  },
  file: {
    uploaded: (fileName: string) =>
      showSuccessToast("File Uploaded", `${fileName} has been uploaded successfully`),
    deleted: (fileName: string) =>
      showSuccessToast("File Deleted", `${fileName} has been removed`),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} file. Please try again.`),
  },
  aiAction: {
    queued: (action: string) =>
      showSuccessToast("AI Action Queued", `${action} is pending approval`),
    approved: (action: string) =>
      showSuccessToast("AI Action Approved", `${action} has been approved and will be executed`),
    rejected: (action: string) =>
      showSuccessToast("AI Action Rejected", `${action} has been rejected`),
    completed: (action: string) =>
      showSuccessToast("AI Action Complete", `${action} has been completed successfully`),
    error: (action: string) =>
      showErrorToast("AI Action Failed", `${action} failed to execute. Please try again.`),
  },
  workflow: {
    triggered: (workflowName: string) =>
      showSuccessToast("Workflow Triggered", `${workflowName} has been started`),
    completed: (workflowName: string) =>
      showSuccessToast("Workflow Complete", `${workflowName} has completed successfully`),
    error: (workflowName: string) =>
      showErrorToast("Workflow Failed", `${workflowName} encountered an error`),
  },
  user: {
    created: (username: string) =>
      showSuccessToast("User Created", `${username} has been added to the system`),
    updated: (username: string) =>
      showSuccessToast("User Updated", `${username} has been updated successfully`),
    deleted: (username: string) =>
      showSuccessToast("User Deleted", `${username} has been removed from the system`),
    error: (action: string) =>
      showErrorToast("Error", `Failed to ${action} user. Please try again.`),
  },
};
