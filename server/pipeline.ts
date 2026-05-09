/**
 * Pipeline Actions - Job Lifecycle Management
 * 
 * Handles state transitions for estimates, jobs, invoices, and payments.
 * All actions include audit logging and external dispatch coordination.
 * 
 * Used by: AI tools, manual UI actions, webhook callbacks
 */

import { storage } from "./storage";
import { db } from "./db";
import type { Job, Estimate, Invoice } from "@shared/schema";
import { randomUUID } from "crypto";
import { classifyAction, executeAITool } from "./ai-tools";

export async function acceptEstimate(estimateId: string): Promise<{ estimate: Estimate; job: Job }> {
  if (!db) throw new Error("Database not connected");
  
  return db.transaction(async (tx) => {
    const estimate = await storage.getEstimate(estimateId);
    if (!estimate) {
      throw new Error("Estimate not found");
    }

    if (!["draft", "sent"].includes(estimate.status)) {
      throw new Error(`Cannot accept estimate: estimate is ${estimate.status}`);
    }

    const updatedEstimate = await storage.updateEstimate(estimateId, {
      status: "accepted",
    }, tx);

    if (!updatedEstimate) {
      throw new Error("Failed to update estimate");
    }

    await storage.createAuditLogEntry({
      userId: null,
      action: "accept_estimate",
      entityType: "estimate",
      entityId: estimateId,
      details: { status: "accepted" },
    }, tx);

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
      }, tx);
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
      }, tx);
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
        estimatedValue: estimate.totalAmount,
      }, tx);
      
      await storage.updateEstimate(estimateId, {
        jobId: job.id,
      }, tx);
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_job_from_estimate",
        entityType: "job",
        entityId: job.id,
        details: { estimateId, status: "scheduled" },
      }, tx);
    }

    // GOVERNANCE FIX: External dispatch ONLY happens after instruction → approval → dispatch
    // Automatic dispatch from events is NOT allowed - violates governance rules
    // External agents must receive explicit approval before executing any action
    await storage.createAuditLogEntry({
      userId: null,
      action: "external_dispatch_required",
      entityType: "job",
      entityId: job.id,
      details: {
        eventType: "job_updated",
        requiresApproval: true,
        message: "External dispatch queued for approval workflow",
        estimateId: estimate.id,
        amount: estimate.totalAmount,
      },
    }, tx);

    return { estimate: updatedEstimate, job };
  });
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

  if (invoice.jobId) {
    const job = await storage.getJob(invoice.jobId!);
    if (job && job.status !== "paid") {
      await storage.updateJob(invoice.jobId!, {
        status: "invoiced",
      });
    }
    await storage.createAuditLogEntry({
      userId: null,
      action: "update_job_status",
      entityType: "job",
      entityId: invoice.jobId!,
      details: { status: "invoiced", from: "invoice_sent" },
    });
  }

  // GOVERNANCE FIX: External dispatch ONLY happens after instruction → approval → dispatch
  // Automatic dispatch from events is NOT allowed - violates governance rules
  // External agents must receive explicit approval before executing any action
  await storage.createAuditLogEntry({
    userId: null,
    action: "external_dispatch_required",
    entityType: "invoice",
    entityId: invoiceId,
    details: {
      eventType: "invoice_created",
      requiresApproval: true,
      message: "External dispatch queued for approval workflow",
      invoiceNumber: invoiceId.substring(0, 8),
      amount: invoice.totalAmount,
      contactId: invoice.contactId,
    },
  });

  return updated;
}

export async function recordPayment(invoiceId: string, amount: string, method: string, transactionRef?: string): Promise<Invoice> {
  if (!db) throw new Error("Database not connected");
  
  return db.transaction(async (tx) => {
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
    }, tx);

    await storage.createAuditLogEntry({
      userId: null,
      action: "record_payment",
      entityType: "payment",
      entityId: payment.id,
      details: { invoiceId, amount, method },
    }, tx);

    // GOVERNANCE FIX: External dispatch ONLY happens after instruction → approval → dispatch
    // Automatic dispatch from events is NOT allowed - violates governance rules
    const contact = await storage.getContact(invoice.contactId);
    await storage.createAuditLogEntry({
      userId: null,
      action: "external_dispatch_required",
      entityType: "payment",
      entityId: payment.id,
      details: { 
        eventType: "payment_created",
        requiresApproval: true,
        message: "External dispatch queued for approval workflow",
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: payment.amount,
        contactId: invoice.contactId,
        contactEmail: contact?.email || "",
      },
    }, tx);

    // GOVERNANCE FIX: Removed automatic dispatch to /events/payment
    // External dispatch only happens after instruction → approval → dispatch flow
    // This event will be queued for approval workflow instead

    const newTotalPaidCents = totalPaidCents + paymentAmountCents;

    let updatedInvoice: Invoice | undefined;
    
    if (newTotalPaidCents >= invoiceTotalCents) {
      updatedInvoice = await storage.updateInvoice(invoiceId, {
        status: "paid",
        paidAt: new Date(),
      }, tx);

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
      }, tx);

      if (invoice.jobId) {
        const job = await storage.getJob(invoice.jobId!);
        if (job) {
          await storage.updateJob(invoice.jobId!, {
            status: "paid",
          }, tx);
          await storage.createAuditLogEntry({
            userId: null,
            action: "update_job_status",
            entityType: "job",
            entityId: invoice.jobId!,
            details: { status: "paid", from: "payment_received" },
          }, tx);
        }
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
      }, tx);
    }

    if (!updatedInvoice) {
      throw new Error("Failed to get updated invoice");
    }

    return updatedInvoice;
  });
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

export async function finalizeAction(
  proposalId: string,
  performedBy: string
): Promise<FinalizeActionResult> {
  const proposal = await storage.getStagedProposal(proposalId);
  if (!proposal) {
    return { success: false, error: `Proposal ${proposalId} not found` };
  }

  // Parse actions from the proposal (jsonb may be string or already parsed)
  const actions: Array<{ tool: string; args: Record<string, unknown> }> =
    typeof proposal.actions === "string"
      ? JSON.parse(proposal.actions as string)
      : (proposal.actions as Array<{ tool: string; args: Record<string, unknown> }>);

  if (!actions || actions.length === 0) {
    return { success: false, error: "Proposal has no actions to execute" };
  }

  const results: Array<{ tool: string; status: string; result: unknown }> = [];
  let allSucceeded = true;

  for (const action of actions) {
    try {
      const classification = classifyAction(action.tool);

      if (classification === "EXTERNAL") {
        // External dispatch via agent-dispatcher
        const { dispatchToAgent } = await import("./agent-dispatcher");
        await dispatchToAgent({
          proposalId: proposal.id,
          summary: proposal.summary ?? "",
          actions,
          reasoning: proposal.reasoning ?? "",
          approvedBy: proposal.approvedBy ?? performedBy,
          approvedAt: proposal.approvedAt ?? new Date(),
          relatedEntity: proposal.relatedEntity as { type: string; id: string } | undefined,
        });
        results.push({ tool: action.tool, status: "dispatched", result: null });
      } else {
        // Internal execution via AI tools
        const toolResult = await executeAITool(action.tool, action.args);
        results.push({ tool: action.tool, status: "executed", result: toolResult });
      }
    } catch (error: any) {
      allSucceeded = false;
      results.push({ tool: action.tool, status: "failed", result: error.message });
    }
  }

  // Update proposal status
  const finalStatus = allSucceeded ? "completed" : "failed";
  await storage.updateStagedProposal(proposalId, {
    status: finalStatus,
    executedAt: new Date(),
    completedAt: allSucceeded ? new Date() : undefined,
  });

  // Write ledger entry
  await storage.createAutomationLedgerEntry({
    agentName: "Policy Agent",
    actionType: allSucceeded ? "PROPOSAL_EXECUTED" : "PROPOSAL_EXECUTION_FAILED",
    entityType: "staged_proposal",
    entityId: proposalId,
    status: allSucceeded ? "success" : "failed",
    mode: "executed",
    diffJson: { results, performedBy },
    reason: null,
  });

  return {
    success: allSucceeded,
    result: results,
    error: allSucceeded ? undefined : "One or more actions failed",
  };
}
