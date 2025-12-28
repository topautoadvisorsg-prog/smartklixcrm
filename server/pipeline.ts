import { storage } from "./storage";
import type { Job, Estimate, Invoice } from "@shared/schema";
import { dispatchNeo8Event, createNeo8Event, dispatchToN8nWebhook } from "./neo8-events";
import { randomUUID } from "crypto";
import { classifyAction, isExternalAction } from "./ai-tools";

export async function acceptEstimate(estimateId: string): Promise<{ estimate: Estimate; job: Job }> {
  const estimate = await storage.getEstimate(estimateId);
  if (!estimate) {
    throw new Error("Estimate not found");
  }

  if (!["draft", "sent"].includes(estimate.status)) {
    throw new Error(`Cannot accept estimate: estimate is ${estimate.status}`);
  }

  const updatedEstimate = await storage.updateEstimate(estimateId, {
    status: "accepted",
  });

  if (!updatedEstimate) {
    throw new Error("Failed to update estimate");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "accept_estimate",
    entityType: "estimate",
    entityId: estimateId,
    details: { status: "accepted" },
  });

  let job: Job;
  
  if (estimate.jobId) {
    const existingJob = await storage.getJob(estimate.jobId);
    if (!existingJob) {
      throw new Error("Linked job not found");
    }
    
    if (!["lead_intake", "estimate_sent", "scheduled"].includes(existingJob.status)) {
      throw new Error(`Cannot accept estimate: job is already ${existingJob.status}`);
    }
    
    const updatedJob = await storage.updateJob(estimate.jobId, {
      status: "scheduled",
      jobType: "job",
      sourceEstimateId: estimateId,
    });
    if (!updatedJob) {
      throw new Error("Failed to update existing job");
    }
    job = updatedJob;
    
    await storage.createAuditLogEntry({
      userId: null,
      action: "update_job_status",
      entityType: "job",
      entityId: job.id,
      details: { status: "scheduled", from: "estimate_accepted", previousStatus: existingJob.status },
    });
  } else {
    const contact = await storage.getContact(estimate.contactId);
    const jobNumber = `JOB-${Date.now()}`;
    
    job = await storage.createJob({
      title: `Job from Estimate ${estimateId.substring(0, 8)}`,
      clientId: estimate.contactId,
      status: "scheduled",
      jobType: "job",
      jobNumber,
      sourceEstimateId: estimateId,
      value: estimate.totalAmount,
    });
    
    await storage.updateEstimate(estimateId, {
      jobId: job.id,
    });
    
    await storage.createAuditLogEntry({
      userId: null,
      action: "create_job_from_estimate",
      entityType: "job",
      entityId: job.id,
      details: { estimateId, status: "scheduled" },
    });
  }

  const contact = await storage.getContact(estimate.contactId);
  const neo8Event = createNeo8Event("job_updated", job.id, {
    leadName: contact?.name || "",
    customerId: estimate.contactId,
    amount: estimate.totalAmount,
  });
  
  const dispatchResult = await dispatchNeo8Event(neo8Event);
  await storage.createAuditLogEntry({
    userId: null,
    action: "neo8_event_dispatched",
    entityType: "job",
    entityId: job.id,
    details: {
      eventType: "job_updated",
      success: dispatchResult.success,
      error: dispatchResult.error,
    },
  });

  return { estimate: updatedEstimate, job };
}

export async function rejectEstimate(estimateId: string): Promise<Estimate> {
  const estimate = await storage.getEstimate(estimateId);
  if (!estimate) {
    throw new Error("Estimate not found");
  }

  const updated = await storage.updateEstimate(estimateId, {
    status: "rejected",
  });

  if (!updated) {
    throw new Error("Failed to update estimate");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "reject_estimate",
    entityType: "estimate",
    entityId: estimateId,
    details: { status: "rejected" },
  });

  if (estimate.jobId) {
    await storage.updateJob(estimate.jobId, {
      status: "cancelled",
    });
    
    await storage.createAuditLogEntry({
      userId: null,
      action: "update_job_status",
      entityType: "job",
      entityId: estimate.jobId,
      details: { status: "cancelled", from: "estimate_rejected" },
    });
  }

  return updated;
}

export async function sendEstimate(estimateId: string): Promise<Estimate> {
  const estimate = await storage.getEstimate(estimateId);
  if (!estimate) {
    throw new Error("Estimate not found");
  }

  const updated = await storage.updateEstimate(estimateId, {
    status: "sent",
  });

  if (!updated) {
    throw new Error("Failed to update estimate");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "send_estimate",
    entityType: "estimate",
    entityId: estimateId,
    details: { status: "sent" },
  });

  return updated;
}

export async function startJob(jobId: string): Promise<Job> {
  const job = await storage.getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const updated = await storage.updateJob(jobId, {
    status: "in_progress",
  });

  if (!updated) {
    throw new Error("Failed to update job");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "start_job",
    entityType: "job",
    entityId: jobId,
    details: { status: "in_progress" },
  });

  return updated;
}

export async function completeJob(jobId: string): Promise<Job> {
  const job = await storage.getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const updated = await storage.updateJob(jobId, {
    status: "completed",
    closedAt: new Date(),
  });

  if (!updated) {
    throw new Error("Failed to update job");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "complete_job",
    entityType: "job",
    entityId: jobId,
    details: { status: "completed", closedAt: new Date() },
  });

  return updated;
}

export async function sendInvoice(invoiceId: string): Promise<Invoice> {
  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);

  const updated = await storage.updateInvoice(invoiceId, {
    status: "sent",
    issuedAt: now,
    dueAt: dueDate,
  });

  if (!updated) {
    throw new Error("Failed to update invoice");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "send_invoice",
    entityType: "invoice",
    entityId: invoiceId,
    details: { status: "sent", issuedAt: now, dueAt: dueDate },
  });

  const job = await storage.getJob(invoice.jobId);
  if (job && job.status !== "paid") {
    await storage.updateJob(invoice.jobId, {
      status: "invoiced",
    });
    await storage.createAuditLogEntry({
      userId: null,
      action: "update_job_status",
      entityType: "job",
      entityId: invoice.jobId,
      details: { status: "invoiced", from: "invoice_sent" },
    });
  }

  const contact = await storage.getContact(invoice.contactId);
  const neo8Event = createNeo8Event("invoice_created", invoiceId, {
    customerId: invoice.contactId,
    amount: invoice.totalAmount,
    toEmail: contact?.email || "",
    subject: `Invoice #${invoiceId.substring(0, 8)} - ${invoice.totalAmount}`,
  });
  
  const dispatchResult = await dispatchNeo8Event(neo8Event);
  await storage.createAuditLogEntry({
    userId: null,
    action: "neo8_event_dispatched",
    entityType: "invoice",
    entityId: invoiceId,
    details: {
      eventType: "invoice_created",
      success: dispatchResult.success,
      error: dispatchResult.error,
    },
  });

  return updated;
}

export async function recordPayment(invoiceId: string, amount: string, method: string, transactionRef?: string): Promise<Invoice> {
  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
    throw new Error("Payment amount must be a valid decimal number (e.g., 100 or 100.50)");
  }

  const paymentAmountCents = Math.round(parseFloat(amount) * 100);
  if (paymentAmountCents <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const existingPayments = await storage.getPayments();
  const invoicePayments = existingPayments.filter(p => p.invoiceId === invoiceId && p.status === "completed");
  const totalPaidCents = invoicePayments.reduce((sum, p) => sum + Math.round(parseFloat(p.amount) * 100), 0);
  const invoiceTotalCents = Math.round(parseFloat(invoice.totalAmount) * 100);
  const outstandingBalanceCents = invoiceTotalCents - totalPaidCents;

  if (paymentAmountCents > outstandingBalanceCents) {
    const outstandingDollars = (outstandingBalanceCents / 100).toFixed(2);
    const paymentDollars = (paymentAmountCents / 100).toFixed(2);
    throw new Error(`Payment amount $${paymentDollars} exceeds outstanding balance $${outstandingDollars}`);
  }

  const payment = await storage.createPayment({
    invoiceId,
    amount,
    method,
    transactionRef: transactionRef || null,
    status: "completed",
    paidAt: new Date(),
  });

  await storage.createAuditLogEntry({
    userId: null,
    action: "record_payment",
    entityType: "payment",
    entityId: payment.id,
    details: { invoiceId, amount, method },
  });

  // Dispatch payment event to n8n webhook
  const contact = await storage.getContact(invoice.contactId);
  const n8nPaymentResult = await dispatchToN8nWebhook("/payment/create", {
    paymentId: payment.id,
    invoiceId: invoice.id,
    jobId: invoice.jobId,
    contactId: invoice.contactId,
    contactEmail: contact?.email || "",
    contactPhone: contact?.phone || "",
    contactName: contact?.name || "",
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    transactionRef: payment.transactionRef || "",
    paidAt: payment.paidAt?.toISOString() || new Date().toISOString(),
  });

  await storage.createAuditLogEntry({
    userId: null,
    action: "n8n_payment_webhook_dispatched",
    entityType: "payment",
    entityId: payment.id,
    details: { 
      webhookPath: "/payment/create",
      success: n8nPaymentResult.success,
      error: n8nPaymentResult.error,
    },
  });

  // Dispatch to payment events webhook for lifecycle routing
  await dispatchToN8nWebhook("/events/payment", {
    eventType: "payment_complete",
    paymentId: payment.id,
    invoiceId: invoice.id,
    jobId: invoice.jobId,
    contactId: invoice.contactId,
    contactEmail: contact?.email || "",
    contactPhone: contact?.phone || "",
    contactName: contact?.name || "",
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    transactionRef: payment.transactionRef || "",
    paidAt: payment.paidAt?.toISOString() || new Date().toISOString(),
  });

  const newTotalPaidCents = totalPaidCents + paymentAmountCents;

  let updatedInvoice: Invoice | undefined;
  
  if (newTotalPaidCents >= invoiceTotalCents) {
    updatedInvoice = await storage.updateInvoice(invoiceId, {
      status: "paid",
      paidAt: new Date(),
    });

    if (!updatedInvoice) {
      throw new Error("Failed to update invoice");
    }

    await storage.createAuditLogEntry({
      userId: null,
      action: "mark_invoice_paid",
      entityType: "invoice",
      entityId: invoiceId,
      details: { 
        status: "paid", 
        paidAt: new Date(), 
        totalPaid: (newTotalPaidCents / 100).toFixed(2), 
        invoiceTotal: (invoiceTotalCents / 100).toFixed(2) 
      },
    });

    const job = await storage.getJob(invoice.jobId);
    if (job) {
      await storage.updateJob(invoice.jobId, {
        status: "paid",
      });
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_job_status",
        entityType: "job",
        entityId: invoice.jobId,
        details: { status: "paid", from: "payment_received" },
      });
    }
  } else {
    updatedInvoice = await storage.getInvoice(invoiceId);
    
    await storage.createAuditLogEntry({
      userId: null,
      action: "partial_payment_received",
      entityType: "invoice",
      entityId: invoiceId,
      details: { 
        partialAmount: amount, 
        totalPaid: (newTotalPaidCents / 100).toFixed(2), 
        invoiceTotal: (invoiceTotalCents / 100).toFixed(2), 
        remaining: ((invoiceTotalCents - newTotalPaidCents) / 100).toFixed(2) 
      },
    });
  }

  if (!updatedInvoice) {
    throw new Error("Failed to get updated invoice");
  }

  return updatedInvoice;
}

export async function assignTechnician(jobId: string, technicianId: string): Promise<Job> {
  const job = await storage.getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const currentTechs = (job.assignedTechs as string[]) || [];
  if (!currentTechs.includes(technicianId)) {
    currentTechs.push(technicianId);
  }

  const updated = await storage.updateJob(jobId, {
    assignedTechs: currentTechs as any,
  });

  if (!updated) {
    throw new Error("Failed to update job");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "assign_technician",
    entityType: "job",
    entityId: jobId,
    details: { technicianId, assignedTechs: currentTechs },
  });

  return updated;
}

export async function updateJobStatus(jobId: string, status: string): Promise<Job> {
  const job = await storage.getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const updates: any = { status };
  
  if (status === "completed" && !job.closedAt) {
    updates.closedAt = new Date();
  }

  const updated = await storage.updateJob(jobId, updates);

  if (!updated) {
    throw new Error("Failed to update job");
  }

  await storage.createAuditLogEntry({
    userId: null,
    action: "update_job_status",
    entityType: "job",
    entityId: jobId,
    details: { status, previousStatus: job.status },
  });

  return updated;
}

export interface FinalizeActionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export async function finalizeAction(assistQueueId: string, approvedByUserId?: string): Promise<FinalizeActionResult> {
  const queueEntry = await storage.getAssistQueueEntry(assistQueueId);
  if (!queueEntry) {
    return { success: false, error: "Queue entry not found" };
  }

  if (queueEntry.status !== "pending_approval") {
    return { success: false, error: `Cannot finalize: entry status is '${queueEntry.status}'` };
  }

  if (!queueEntry.gatedActionType || !queueEntry.finalizationPayload) {
    return { success: false, error: "Queue entry missing gated action type or payload" };
  }

  const toolName = queueEntry.gatedActionType;
  const payload = queueEntry.finalizationPayload as Record<string, unknown>;
  const actionType = classifyAction(toolName);

  try {
    // GOVERNANCE: EXTERNAL actions MUST be dispatched to Neo-8, NEVER executed directly
    if (actionType === "EXTERNAL") {
      const traceId = `neo8_finalize_${assistQueueId}_${Date.now()}`;
      
      // Write EXECUTION_DISPATCHED ledger entry BEFORE dispatch
      await storage.createAutomationLedgerEntry({
        agentName: "Master Architect",
        actionType: "EXECUTION_DISPATCHED",
        entityType: "assist_queue",
        entityId: assistQueueId,
        mode: "finalize",
        status: "dispatched",
        diffJson: {
          toolName,
          actionType: "EXTERNAL",
          traceId,
          dispatchedTo: "neo8",
          payload,
        },
        reason: null,
        assistQueueId,
      });
      
      // Dispatch to Neo-8 webhook (Neo-8 will execute and callback)
      const dispatchResult = await dispatchNeo8Event({
        eventType: toolName as "send_email" | "send_sms" | "new_lead" | "job_updated" | "missed_call" | "invoice_created" | "create_payment_link" | "payment_created",
        eventId: traceId,
        ...payload,
      } as Parameters<typeof dispatchNeo8Event>[0]);
      
      if (!dispatchResult.success) {
        // Record dispatch failure
        await storage.createAutomationLedgerEntry({
          agentName: "Master Architect",
          actionType: "EXECUTION_DISPATCH_FAILED",
          entityType: "assist_queue",
          entityId: assistQueueId,
          mode: "finalize",
          status: "failed",
          diffJson: {
            toolName,
            actionType: "EXTERNAL",
            traceId,
            error: dispatchResult.error,
          },
          reason: dispatchResult.error || "Neo-8 dispatch failed",
          assistQueueId,
        });
        
        await storage.updateAssistQueueEntry(assistQueueId, {
          status: "dispatch_failed",
          error: dispatchResult.error || "Failed to dispatch to Neo-8",
        });
        
        return { success: false, error: dispatchResult.error || "Failed to dispatch to Neo-8" };
      }
      
      // Update queue entry to dispatched status (awaiting Neo-8 callback)
      await storage.updateAssistQueueEntry(assistQueueId, {
        status: "dispatched",
        approvedBy: approvedByUserId ?? null,
        approvedAt: new Date(),
      });
      
      await storage.createAuditLogEntry({
        userId: approvedByUserId ?? null,
        action: "gated_action_dispatched_to_neo8",
        entityType: "assist_queue",
        entityId: assistQueueId,
        details: { toolName, payload, traceId, dispatchedTo: "neo8" },
      });
      
      return { 
        success: true, 
        result: { 
          traceId, 
          dispatchedTo: "neo8", 
          message: "Action dispatched to Neo-8 for execution. Awaiting callback." 
        } 
      };
    }
    
    // INTERNAL actions can still execute directly (but gated actions are typically EXTERNAL)
    // This is a safety fallback - most gated actions should be EXTERNAL
    console.warn(`[Governance] INTERNAL gated action "${toolName}" - executing directly. Consider if this should be EXTERNAL.`);
    
    let result: unknown;
    switch (toolName) {
      default:
        return { success: false, error: `Unknown or unsupported gated action type: ${toolName}` };
    }

    await storage.updateAssistQueueEntry(assistQueueId, {
      status: "executed",
      approvedBy: approvedByUserId ?? null,
      approvedAt: new Date(),
      executedAt: new Date(),
      completedAt: new Date(),
    });

    await storage.createAuditLogEntry({
      userId: approvedByUserId ?? null,
      action: "gated_action_finalized",
      entityType: "assist_queue",
      entityId: assistQueueId,
      details: { toolName, payload, result },
    });

    return { success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await storage.updateAssistQueueEntry(assistQueueId, {
      status: "failed",
      error: errorMessage,
      executedAt: new Date(),
    });

    await storage.createAuditLogEntry({
      userId: approvedByUserId ?? null,
      action: "gated_action_failed",
      entityType: "assist_queue",
      entityId: assistQueueId,
      details: { toolName, payload, error: errorMessage },
    });

    return { success: false, error: errorMessage };
  }
}
