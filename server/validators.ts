/**
 * Unified Validation Layer
 * 
 * Centralized validation utilities for relationship enforcement.
 * All write operations must pass through these validators before database writes.
 * 
 * This is Layer 2 (Business Logic), not Layer 3 (Routes).
 * Routes call validators, validators enforce rules.
 */

import { storage } from "./storage";

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate that a contact exists
 * @throws ValidationError if contact not found
 */
export async function validateContactExists(contactId: string): Promise<void> {
  if (!contactId) {
    throw new ValidationError("contactId is required", "contactId", "MISSING_FIELD");
  }
  
  const contact = await storage.getContact(contactId);
  if (!contact) {
    throw new ValidationError(
      `Contact with ID ${contactId} does not exist`,
      "contactId",
      "INVALID_REFERENCE"
    );
  }
}

/**
 * Validate that a job exists
 * @throws ValidationError if job not found
 */
export async function validateJobExists(jobId: string): Promise<void> {
  if (!jobId) {
    throw new ValidationError("jobId is required", "jobId", "MISSING_FIELD");
  }
  
  const job = await storage.getJob(jobId);
  if (!job) {
    throw new ValidationError(
      `Job with ID ${jobId} does not exist`,
      "jobId",
      "INVALID_REFERENCE"
    );
  }
}

/**
 * Validate that a job belongs to a contact
 * @throws ValidationError if relationship is invalid
 */
export async function validateJobBelongsToContact(
  jobId: string,
  contactId: string
): Promise<void> {
  await validateJobExists(jobId);
  await validateContactExists(contactId);
  
  const job = await storage.getJob(jobId);
  if (job?.clientId !== contactId) {
    throw new ValidationError(
      `Job ${jobId} does not belong to contact ${contactId}`,
      "jobId",
      "INVALID_RELATIONSHIP"
    );
  }
}

/**
 * Validate financial record integrity
 * 
 * CRITICAL: Financial records are the money layer.
 * Must enforce amount validity, type consistency, and relationship integrity.
 * 
 * @throws ValidationError if financial data is invalid
 */
export async function validateFinancialIntegrity(data: {
  contactId: string;
  jobId?: string;
  type: string;
  amount: number | string;
}): Promise<void> {
  // 1. Validate contact exists (REQUIRED)
  await validateContactExists(data.contactId);
  
  // 2. Validate job exists and belongs to contact (if provided)
  if (data.jobId) {
    await validateJobBelongsToContact(data.jobId, data.contactId);
  }
  
  // 3. Validate amount
  const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
  
  if (isNaN(amount)) {
    throw new ValidationError(
      "Amount must be a valid number",
      "amount",
      "INVALID_AMOUNT"
    );
  }
  
  if (amount <= 0) {
    throw new ValidationError(
      "Amount must be greater than 0",
      "amount",
      "INVALID_AMOUNT"
    );
  }
  
  // 4. Validate type consistency
  if (!['income', 'expense'].includes(data.type)) {
    throw new ValidationError(
      `Type must be 'income' or 'expense', got '${data.type}'`,
      "type",
      "INVALID_TYPE"
    );
  }
}

/**
 * Validate export parameters
 * @returns validated filter object with defaults applied
 */
export function validateExportParams(params: {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): { fromDate?: Date; toDate?: Date; limit: number; dateRangeApplied: string } {
  const MAX_LIMIT = 5000;
  const DEFAULT_DAYS = 90;
  
  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  let dateRangeApplied: string;
  
  if (params.fromDate) {
    fromDate = new Date(params.fromDate);
    if (isNaN(fromDate.getTime())) {
      throw new ValidationError("Invalid fromDate format. Use ISO 8601 (YYYY-MM-DD)", "fromDate", "INVALID_DATE");
    }
  }
  
  if (params.toDate) {
    toDate = new Date(params.toDate);
    if (isNaN(toDate.getTime())) {
      throw new ValidationError("Invalid toDate format. Use ISO 8601 (YYYY-MM-DD)", "toDate", "INVALID_DATE");
    }
  }
  
  // If no date range provided, apply default
  if (!fromDate && !toDate) {
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - DEFAULT_DAYS);
    dateRangeApplied = `default-${DEFAULT_DAYS}-days`;
  } else {
    dateRangeApplied = `custom:${params.fromDate || 'open'}_to_${params.toDate || 'open'}`;
  }
  
  const limit = Math.min(params.limit || MAX_LIMIT, MAX_LIMIT);
  
  return { fromDate, toDate, limit, dateRangeApplied };
}
