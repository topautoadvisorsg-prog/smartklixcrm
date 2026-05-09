/**
 * Field Reports & Financial Records API Routes
 * 
 * Provides endpoints for:
 * - Field reports (CRUD + filtering)
 * - Financial records (CRUD + filtering + summary)
 * - Export center (CSV downloads with filtering)
 * 
 * TODO: Performance optimization for datasets >10,000 rows
 * Current implementation loads all records into memory.
 * When dataset grows beyond MVP stage, implement:
 * 1. SQL WHERE clause filtering (reduce memory load)
 * 2. Streaming CSV generation (row-by-row processing)
 * 3. Background job processing (async export for large datasets)
 * 4. Pagination support (chunked exports)
 */

import { Router } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertFieldReportSchema, insertFinancialRecordSchema } from "@shared/schema";
import { validateContactExists, validateJobExists, validateFinancialIntegrity, ValidationError } from "./validators";

const router = Router();

// Export guardrails
const MAX_EXPORT_ROWS = 5000;
const DEFAULT_EXPORT_DAYS = 90;

// Rate limiting for exports (simple in-memory implementation)
const exportRateLimit = new Map<string, { count: number; resetAt: number }>();
const EXPORT_RATE_LIMIT = 10; // 10 exports per window
const EXPORT_RATE_WINDOW = 60 * 1000; // 1 minute

function checkExportRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const client = exportRateLimit.get(clientId);
  
  if (!client || now > client.resetAt) {
    // New window
    exportRateLimit.set(clientId, { count: 1, resetAt: now + EXPORT_RATE_WINDOW });
    return { allowed: true, remaining: EXPORT_RATE_LIMIT - 1 };
  }
  
  if (client.count >= EXPORT_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  client.count++;
  return { allowed: true, remaining: EXPORT_RATE_LIMIT - client.count };
}

// ========================================
// FIELD REPORTS ENDPOINTS
// ========================================

// GET /api/field-reports - Get field reports with optional filters
router.get("/field-reports", async (req, res) => {
  try {
    const { jobId, contactId, type } = req.query;
    const filters: { jobId?: string; contactId?: string; type?: string } = {};
    if (jobId) filters.jobId = jobId as string;
    if (contactId) filters.contactId = contactId as string;
    if (type) filters.type = type as string;

    const reports = await storage.getFieldReports(filters);
    res.json(reports);
  } catch (error) {
    console.error("Error fetching field reports:", error);
    res.status(500).json({ error: "Failed to fetch field reports" });
  }
});

// GET /api/field-reports/:id - Get single field report
router.get("/field-reports/:id", async (req, res) => {
  try {
    const report = await storage.getFieldReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Field report not found" });
    }
    res.json(report);
  } catch (error) {
    console.error("Error fetching field report:", error);
    res.status(500).json({ error: "Failed to fetch field report" });
  }
});

// POST /api/field-reports - Create field report
router.post("/field-reports", async (req, res) => {
  try {
    const validatedData = insertFieldReportSchema.parse(req.body);
    
    // Use unified validators
    if (validatedData.jobId) {
      await validateJobExists(validatedData.jobId);
    }
    if (validatedData.contactId) {
      await validateContactExists(validatedData.contactId);
    }
    
    const report = await storage.createFieldReport(validatedData);
    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      const validationError = error as any;
      return res.status(400).json({ 
        error: error.message, 
        field: validationError.field,
        code: validationError.code
      });
    }
    console.error("Error creating field report:", error);
    res.status(500).json({ error: "Failed to create field report" });
  }
});

// PUT /api/field-reports/:id - Update field report
router.put("/field-reports/:id", async (req, res) => {
  try {
    // STEP 1: Validate input with Zod
    const validatedData = insertFieldReportSchema.partial().parse(req.body);
    
    // STEP 2: Validate relationships if fields are being updated
    if (validatedData.jobId) {
      await validateJobExists(validatedData.jobId);
    }
    if (validatedData.contactId) {
      await validateContactExists(validatedData.contactId);
    }
    // Validate job belongs to contact if both are present
    if (validatedData.jobId && validatedData.contactId) {
      const job = await storage.getJob(validatedData.jobId);
      if (job?.clientId !== validatedData.contactId) {
        return res.status(400).json({
          error: "Job does not belong to the specified contact",
          field: "jobId",
          code: "INVALID_RELATIONSHIP"
        });
      }
    }
    
    // STEP 3: Update record
    const report = await storage.updateFieldReport(req.params.id, validatedData);
    if (!report) {
      return res.status(404).json({ error: "Field report not found" });
    }
    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      const validationError = error as any;
      return res.status(400).json({ 
        error: error.message, 
        field: validationError.field,
        code: validationError.code
      });
    }
    console.error("Error updating field report:", error);
    res.status(500).json({ error: "Failed to update field report" });
  }
});

// DELETE /api/field-reports/:id - Delete field report
router.delete("/field-reports/:id", async (req, res) => {
  try {
    const success = await storage.deleteFieldReport(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Field report not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting field report:", error);
    res.status(500).json({ error: "Failed to delete field report" });
  }
});

// ========================================
// FINANCIAL RECORDS ENDPOINTS
// ========================================

// GET /api/financial-records - Get financial records with optional filters
router.get("/financial-records", async (req, res) => {
  try {
    const { contactId, jobId, type, fromDate, toDate } = req.query;
    const filters: { 
      contactId?: string; 
      jobId?: string; 
      type?: string; 
      fromDate?: Date; 
      toDate?: Date 
    } = {};
    if (contactId) filters.contactId = contactId as string;
    if (jobId) filters.jobId = jobId as string;
    if (type) filters.type = type as string;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);

    const records = await storage.getFinancialRecords(filters);
    res.json(records);
  } catch (error) {
    console.error("Error fetching financial records:", error);
    res.status(500).json({ error: "Failed to fetch financial records" });
  }
});

// GET /api/financial-records/:id - Get single financial record
router.get("/financial-records/:id", async (req, res) => {
  try {
    const record = await storage.getFinancialRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Financial record not found" });
    }
    res.json(record);
  } catch (error) {
    console.error("Error fetching financial record:", error);
    res.status(500).json({ error: "Failed to fetch financial record" });
  }
});

// POST /api/financial-records - Create financial record
router.post("/financial-records", async (req, res) => {
  try {
    const validatedData = insertFinancialRecordSchema.parse(req.body);
    
    // Use unified financial integrity validator
    await validateFinancialIntegrity({
      contactId: validatedData.contactId,
      jobId: validatedData.jobId || undefined,
      type: validatedData.type,
      amount: validatedData.amount
    });
    
    const record = await storage.createFinancialRecord(validatedData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      const validationError = error as any;
      return res.status(400).json({ 
        error: error.message, 
        field: validationError.field,
        code: validationError.code
      });
    }
    console.error("Error creating financial record:", error);
    res.status(500).json({ error: "Failed to create financial record" });
  }
});

// PUT /api/financial-records/:id - Update financial record
router.put("/financial-records/:id", async (req, res) => {
  try {
    // STEP 1: Validate input with Zod
    const validatedData = insertFinancialRecordSchema.partial().parse(req.body);
    
    // STEP 2: Get existing record to merge with updates
    const existingRecord = await storage.getFinancialRecord(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Financial record not found" });
    }
    
    // STEP 3: Merge updates with existing data for validation
    const mergedData = {
      contactId: validatedData.contactId || existingRecord.contactId,
      jobId: validatedData.jobId || existingRecord.jobId || undefined,
      type: validatedData.type || existingRecord.type,
      amount: validatedData.amount || existingRecord.amount
    };
    
    // STEP 4: Validate financial integrity
    await validateFinancialIntegrity(mergedData);
    
    // STEP 5: Update record
    const record = await storage.updateFinancialRecord(req.params.id, validatedData);
    if (!record) {
      return res.status(404).json({ error: "Financial record not found" });
    }
    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      const validationError = error as any;
      return res.status(400).json({ 
        error: error.message, 
        field: validationError.field,
        code: validationError.code
      });
    }
    console.error("Error updating financial record:", error);
    res.status(500).json({ error: "Failed to update financial record" });
  }
});

// DELETE /api/financial-records/:id - Delete financial record
router.delete("/financial-records/:id", async (req, res) => {
  try {
    const success = await storage.deleteFinancialRecord(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Financial record not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting financial record:", error);
    res.status(500).json({ error: "Failed to delete financial record" });
  }
});

// GET /api/financial-records/summary - Get financial summary for a contact
router.get("/financial-records/summary", async (req, res) => {
  try {
    const { contactId } = req.query;
    if (!contactId) {
      return res.status(400).json({ error: "contactId query parameter is required" });
    }

    const summary = await storage.getFinancialSummary(contactId as string);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching financial summary:", error);
    res.status(500).json({ error: "Failed to fetch financial summary" });
  }
});

// ========================================
// EXPORT CENTER ENDPOINTS
// ========================================

/**
 * Apply date filtering with explicit soft/hard behavior
 * 
 * @returns { filtered: T[], dateRangeApplied: string }
 * 
 * Behavior:
 * - If no date filters: auto-apply 90-day window (SOFT LIMIT)
 * - If explicit filters: use provided range
 * - Returns dateRangeApplied string for transparency header
 */
function applyDateFilter<T extends { createdAt?: Date | string }>(
  data: T[],
  fromDate?: string | Date,
  toDate?: string | Date
): { filtered: T[]; dateRangeApplied: string } {
  let filtered = data;
  let dateRangeApplied: string;
  
  if (!fromDate && !toDate) {
    // SOFT LIMIT: Auto-apply 90-day window
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_EXPORT_DAYS);
    const defaultTo = new Date();
    
    filtered = filtered.filter(item => {
      const itemDate = item.createdAt ? new Date(item.createdAt) : new Date(0);
      return itemDate >= defaultFrom && itemDate <= defaultTo;
    });
    
    dateRangeApplied = `default-${DEFAULT_EXPORT_DAYS}-days`;
  } else {
    // CUSTOM: Use explicit date range - VALIDATE DATES FIRST
    let from: Date | undefined;
    let to: Date | undefined;
    
    if (fromDate) {
      from = new Date(fromDate as string);
      if (isNaN(from.getTime())) {
        throw new ValidationError(
          "Invalid fromDate format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)",
          "fromDate",
          "INVALID_DATE"
        );
      }
    }
    
    if (toDate) {
      to = new Date(toDate as string);
      if (isNaN(to.getTime())) {
        throw new ValidationError(
          "Invalid toDate format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)",
          "toDate",
          "INVALID_DATE"
        );
      }
    }
    
    // CRITICAL: Validate date range logic (fromDate must be before toDate)
    if (from && to && from > to) {
      throw new ValidationError(
        "fromDate must be before toDate",
        "fromDate",
        "INVALID_DATE_RANGE"
      );
    }
    
    // Apply validated date filters
    if (from) {
      filtered = filtered.filter(item => {
        const itemDate = item.createdAt ? new Date(item.createdAt) : new Date(0);
        return itemDate >= from;
      });
    }
    if (to) {
      filtered = filtered.filter(item => {
        const itemDate = item.createdAt ? new Date(item.createdAt) : new Date(0);
        return itemDate <= to;
      });
    }
    
    dateRangeApplied = `custom:${fromDate || 'open'}_to_${toDate || 'open'}`;
  }
  
  return { filtered, dateRangeApplied };
}

// Helper function to convert array to CSV
function convertToCSV(data: any[], columns: string[]): string {
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return "";
    
    // Handle Date objects - convert to ISO string
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Handle arrays - join with semicolon
    if (Array.isArray(value)) {
      value = value.join("; ");
    }
    
    const str = String(value);
    
    // CRITICAL: Prevent CSV formula injection (Excel/Google Sheets)
    // Prefix values starting with =, +, -, @ with a single quote to neutralize formulas
    if (/^[=+\-@]/.test(str)) {
      // Just prefix with quote, no need to wrap unless it also has commas/quotes
      const escaped = str.replace(/"/g, '""');
      if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
        return `"'${escaped}"`;
      }
      return `'${escaped}`;
    }
    
    // Standard CSV escaping
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.join(",");
  const rows = data.map(row => 
    columns.map(col => escapeCSV(row[col])).join(",")
  );
  
  return [header, ...rows].join("\n");
}

// GET /api/export/contacts - Export contacts to CSV
router.get("/export/contacts", async (req, res) => {
  try {
    // Rate limiting check
    const clientId = req.session?.id || req.ip || 'unknown';
    const rateLimit = checkExportRateLimit(clientId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Too many export requests",
        message: "Rate limit exceeded. Please wait a moment before exporting again.",
        retryAfter: 60
      });
    }
    
    const { status, source, contactType, fromDate, toDate } = req.query;
    const contacts = await storage.getContacts();
    
    // Apply status/type filters first
    let filtered = contacts;
    if (status) filtered = filtered.filter(c => c.status === status);
    if (source) filtered = filtered.filter(c => c.source === source);
    if (contactType) filtered = filtered.filter(c => c.contactType === contactType);
    
    // Apply date filtering (with soft limit transparency)
    const { filtered: dateFiltered, dateRangeApplied } = applyDateFilter(
      filtered, 
      fromDate as string | undefined, 
      toDate as string | undefined
    );
    filtered = dateFiltered;
    
    // HARD LIMIT: Enforce row count AFTER all filtering
    if (filtered.length > MAX_EXPORT_ROWS) {
      return res.status(400).json({ 
        error: "Export exceeds maximum row limit",
        message: `Result set has ${filtered.length} rows. Maximum ${MAX_EXPORT_ROWS} rows allowed. Please narrow your date range or add more filters.`,
        maxRows: MAX_EXPORT_ROWS,
        actualRows: filtered.length,
        suggestion: "Add fromDate and toDate query parameters to reduce the dataset"
      });
    }

    const columns = [
      "id", "name", "email", "phone", "company", "contactType", 
      "status", "source", "tags", "createdAt", "updatedAt"
    ];
    
    const csv = convertToCSV(filtered, columns);
    
    // Add metadata headers (TRANSPARENCY)
    res.setHeader("X-Total-Rows", filtered.length);
    res.setHeader("X-Export-Timestamp", new Date().toISOString());
    res.setHeader("X-Date-Range-Applied", dateRangeApplied);
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts_export.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error exporting contacts:", error);
    res.status(500).json({ error: "Failed to export contacts" });
  }
});

// GET /api/export/jobs - Export jobs to CSV
router.get("/export/jobs", async (req, res) => {
  try {
    // Rate limiting check
    const clientId = req.session?.id || req.ip || 'unknown';
    const rateLimit = checkExportRateLimit(clientId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Too many export requests",
        message: "Rate limit exceeded. Please wait a moment before exporting again.",
        retryAfter: 60
      });
    }
    
    const { status, contactId, fromDate, toDate } = req.query;
    const jobs = await storage.getJobs();
    
    // Get contacts for client names
    const contacts = await storage.getContacts();
    const contactMap = new Map(contacts.map(c => [c.id, c.name]));
    
    // Apply filters
    let filtered = jobs;
    if (status) filtered = filtered.filter(j => j.status === status);
    if (contactId) filtered = filtered.filter(j => j.clientId === contactId);
    
    // Apply date filtering (with soft limit transparency)
    const { filtered: dateFiltered, dateRangeApplied } = applyDateFilter(
      filtered,
      fromDate as string | undefined,
      toDate as string | undefined
    );
    filtered = dateFiltered;
    
    // HARD LIMIT: Enforce row count AFTER all filtering
    if (filtered.length > MAX_EXPORT_ROWS) {
      return res.status(400).json({
        error: "Export exceeds maximum row limit",
        message: `Result set has ${filtered.length} rows. Maximum ${MAX_EXPORT_ROWS} rows allowed. Please narrow your date range or add more filters.`,
        maxRows: MAX_EXPORT_ROWS,
        actualRows: filtered.length,
        suggestion: "Add fromDate and toDate query parameters to reduce the dataset"
      });
    }

    const csvData = filtered.map(job => ({
      jobId: job.id,
      title: job.title,
      clientName: job.clientId ? contactMap.get(job.clientId) || "Unknown" : "N/A",
      status: job.status,
      value: job.estimatedValue || "0",
      scheduledStart: job.scheduledStart || "",
      scheduledEnd: job.scheduledEnd || "",
      createdAt: job.createdAt,
    }));

    const columns = ["jobId", "title", "clientName", "status", "value", "scheduledStart", "scheduledEnd", "createdAt"];
    const csv = convertToCSV(csvData, columns);
    
    // Add metadata headers (TRANSPARENCY)
    res.setHeader("X-Total-Rows", filtered.length);
    res.setHeader("X-Export-Timestamp", new Date().toISOString());
    res.setHeader("X-Date-Range-Applied", dateRangeApplied);
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=jobs_export.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error exporting jobs:", error);
    res.status(500).json({ error: "Failed to export jobs" });
  }
});

// GET /api/export/financials - Export financial records to CSV
router.get("/export/financials", async (req, res) => {
  try {
    // Rate limiting check
    const clientId = req.session?.id || req.ip || 'unknown';
    const rateLimit = checkExportRateLimit(clientId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Too many export requests",
        message: "Rate limit exceeded. Please wait a moment before exporting again.",
        retryAfter: 60
      });
    }
    
    const { contactId, jobId, type, fromDate, toDate } = req.query;
    
    const filters: any = {};
    if (contactId) filters.contactId = contactId;
    if (jobId) filters.jobId = jobId;
    if (type) filters.type = type;
    
    const records = await storage.getFinancialRecords(filters);
    
    // Get contact and job info for relational data
    const contacts = await storage.getContacts();
    const contactMap = new Map(contacts.map(c => [c.id, c.name]));
    
    const jobs = await storage.getJobs();
    const jobMap = new Map(jobs.map(j => [j.id, j.title]));
    
    // Apply date filtering (with soft limit transparency)
    const { filtered: dateFiltered, dateRangeApplied } = applyDateFilter(
      records,
      fromDate as string | undefined,
      toDate as string | undefined
    );
    let filtered = dateFiltered;
    
    // HARD LIMIT: Enforce row count AFTER all filtering
    if (filtered.length > MAX_EXPORT_ROWS) {
      return res.status(400).json({
        error: "Export exceeds maximum row limit",
        message: `Result set has ${filtered.length} rows. Maximum ${MAX_EXPORT_ROWS} rows allowed. Please narrow your date range or add more filters.`,
        maxRows: MAX_EXPORT_ROWS,
        actualRows: filtered.length,
        suggestion: "Add fromDate and toDate query parameters to reduce the dataset"
      });
    }
    
    const csvData = filtered.map(record => ({
      id: record.id,
      contactName: contactMap.get(record.contactId) || "Unknown",
      jobTitle: record.jobId ? (jobMap.get(record.jobId) || "Unknown") : "N/A",
      type: record.type,
      category: record.category || "",
      amount: record.amount || "0",
      description: record.description || "",
      date: record.date instanceof Date ? record.date.toISOString() : String(record.date),
    }));

    const columns = ["id", "contactName", "jobTitle", "type", "category", "amount", "description", "date"];
    const csv = convertToCSV(csvData, columns);
    
    // Add metadata headers (TRANSPARENCY)
    res.setHeader("X-Total-Rows", filtered.length);
    res.setHeader("X-Export-Timestamp", new Date().toISOString());
    res.setHeader("X-Date-Range-Applied", dateRangeApplied);
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=financial_export.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error exporting financial records:", error);
    res.status(500).json({ error: "Failed to export financial records" });
  }
});

// GET /api/export/field-reports - Export field reports to CSV
router.get("/export/field-reports", async (req, res) => {
  try {
    // Rate limiting check
    const clientId = req.session?.id || req.ip || 'unknown';
    const rateLimit = checkExportRateLimit(clientId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Too many export requests",
        message: "Rate limit exceeded. Please wait a moment before exporting again.",
        retryAfter: 60
      });
    }
    
    const { contactId, jobId, type, fromDate, toDate } = req.query;
    
    const filters: any = {};
    if (contactId) filters.contactId = contactId;
    if (jobId) filters.jobId = jobId;
    if (type) filters.type = type;
    
    const reports = await storage.getFieldReports(filters);
    
    // Get contact and job info for relational data
    const contacts = await storage.getContacts();
    const contactMap = new Map(contacts.map(c => [c.id, c.name]));
    
    const jobs = await storage.getJobs();
    const jobMap = new Map(jobs.map(j => [j.id, j.title]));
    
    // Apply date filtering (with soft limit transparency)
    const { filtered: dateFiltered, dateRangeApplied } = applyDateFilter(
      reports,
      fromDate as string | undefined,
      toDate as string | undefined
    );
    let filtered = dateFiltered;
    
    // HARD LIMIT: Enforce row count AFTER all filtering
    if (filtered.length > MAX_EXPORT_ROWS) {
      return res.status(400).json({
        error: "Export exceeds maximum row limit",
        message: `Result set has ${filtered.length} rows. Maximum ${MAX_EXPORT_ROWS} rows allowed. Please narrow your date range or add more filters.`,
        maxRows: MAX_EXPORT_ROWS,
        actualRows: filtered.length,
        suggestion: "Add fromDate and toDate query parameters to reduce the dataset"
      });
    }
    
    const csvData = filtered.map(report => ({
      id: report.id,
      jobId: report.jobId,
      jobTitle: jobMap.get(report.jobId) || "Unknown",
      contactName: contactMap.get(report.contactId) || "Unknown",
      type: report.type,
      notes: report.observations || "",
      photos: Array.isArray(report.photos) ? report.photos.join("; ") : "",
      statusUpdate: report.statusUpdate || "",
      createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : String(report.createdAt),
    }));

    const columns = ["id", "jobId", "jobTitle", "contactName", "type", "notes", "photos", "statusUpdate", "createdAt"];
    const csv = convertToCSV(csvData, columns);
    
    // Add metadata headers (TRANSPARENCY)
    res.setHeader("X-Total-Rows", filtered.length);
    res.setHeader("X-Export-Timestamp", new Date().toISOString());
    res.setHeader("X-Date-Range-Applied", dateRangeApplied);
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=field_reports_export.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error exporting field reports:", error);
    res.status(500).json({ error: "Failed to export field reports" });
  }
});

export default router;
