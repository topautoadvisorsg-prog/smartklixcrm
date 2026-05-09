/**
 * Quick Validation Test for Hardening Changes
 * 
 * Tests:
 * 1. Validators work correctly
 * 2. Export guardrails are in place
 * 3. Financial integrity validation works
 * 
 * Usage: npx tsx server/test-hardening.ts
 */

import { storage } from "./storage";
import { validateContactExists, validateJobExists, validateFinancialIntegrity, ValidationError } from "./validators";
import { fileURLToPath } from 'url';
import path from 'path';

async function testValidators() {
  console.log("\n🧪 Testing Validators...\n");
  
  // Test 1: validateContactExists with invalid ID
  console.log("Test 1: validateContactExists with invalid ID");
  try {
    await validateContactExists("non-existent-id");
    console.log("❌ FAIL: Should have thrown ValidationError");
  } catch (error) {
    if (error instanceof ValidationError && error.code === "INVALID_REFERENCE") {
      console.log("✅ PASS: Correctly rejected invalid contact ID");
    } else {
      console.log("❌ FAIL: Wrong error type or code");
    }
  }
  
  // Test 2: validateJobExists with invalid ID
  console.log("\nTest 2: validateJobExists with invalid ID");
  try {
    await validateJobExists("non-existent-job-id");
    console.log("❌ FAIL: Should have thrown ValidationError");
  } catch (error) {
    if (error instanceof ValidationError && error.code === "INVALID_REFERENCE") {
      console.log("✅ PASS: Correctly rejected invalid job ID");
    } else {
      console.log("❌ FAIL: Wrong error type or code");
    }
  }
  
  // Test 3: validateFinancialIntegrity with negative amount
  console.log("\nTest 3: validateFinancialIntegrity with negative amount");
  try {
    // First create a valid contact to test with
    const contact = await storage.createContact({
      name: "Test Contact",
      email: "test@example.com",
      phone: "+1-555-0000",
      contactType: "individual",
      source: "manual",
      status: "new"
    });
    
    await validateFinancialIntegrity({
      contactId: contact.id,
      type: "income",
      amount: -100 // Invalid: negative
    });
    console.log("❌ FAIL: Should have thrown ValidationError for negative amount");
  } catch (error) {
    if (error instanceof ValidationError && error.code === "INVALID_AMOUNT") {
      console.log("✅ PASS: Correctly rejected negative amount");
    } else {
      console.log("❌ FAIL: Wrong error type or code:", error);
    }
  }
  
  // Test 4: validateFinancialIntegrity with invalid type
  console.log("\nTest 4: validateFinancialIntegrity with invalid type");
  try {
    const contact = await storage.createContact({
      name: "Test Contact 2",
      email: "test2@example.com",
      phone: "+1-555-0001",
      contactType: "individual",
      source: "manual",
      status: "new"
    });
    
    await validateFinancialIntegrity({
      contactId: contact.id,
      type: "refund", // Invalid: must be income or expense
      amount: 100
    });
    console.log("❌ FAIL: Should have thrown ValidationError for invalid type");
  } catch (error) {
    if (error instanceof ValidationError && error.code === "INVALID_TYPE") {
      console.log("✅ PASS: Correctly rejected invalid type");
    } else {
      console.log("❌ FAIL: Wrong error type or code:", error);
    }
  }
  
  console.log("\n✅ Validator tests complete!\n");
}

async function testExportGuardrails() {
  console.log("🔒 Testing Export Guardrails...\n");
  
  // Import the routes file to check constants
  const fs = await import("fs");
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const routesPath = path.join(__dirname, "routes-field-financial-export.ts");
  const routesContent = fs.readFileSync(routesPath, "utf-8");
  
  // Test 1: Check MAX_EXPORT_ROWS constant exists
  console.log("Test 1: MAX_EXPORT_ROWS constant defined");
  if (routesContent.includes("const MAX_EXPORT_ROWS = 5000")) {
    console.log("✅ PASS: MAX_EXPORT_ROWS = 5000");
  } else {
    console.log("❌ FAIL: MAX_EXPORT_ROWS not found or incorrect value");
  }
  
  // Test 2: Check DEFAULT_EXPORT_DAYS constant exists
  console.log("\nTest 2: DEFAULT_EXPORT_DAYS constant defined");
  if (routesContent.includes("const DEFAULT_EXPORT_DAYS = 90")) {
    console.log("✅ PASS: DEFAULT_EXPORT_DAYS = 90");
  } else {
    console.log("❌ FAIL: DEFAULT_EXPORT_DAYS not found or incorrect value");
  }
  
  // Test 3: Check applyDateFilter function exists
  console.log("\nTest 3: applyDateFilter function defined");
  if (routesContent.includes("function applyDateFilter")) {
    console.log("✅ PASS: applyDateFilter function exists");
  } else {
    console.log("❌ FAIL: applyDateFilter function not found");
  }
  
  // Test 4: Check metadata headers are set
  console.log("\nTest 4: Metadata headers in export responses");
  const hasTotalRows = routesContent.includes('X-Total-Rows');
  const hasTimestamp = routesContent.includes('X-Export-Timestamp');
  const hasDateRange = routesContent.includes('X-Date-Range-Applied');
  
  if (hasTotalRows && hasTimestamp && hasDateRange) {
    console.log("✅ PASS: All metadata headers present");
  } else {
    console.log("❌ FAIL: Missing metadata headers");
    console.log("  - X-Total-Rows:", hasTotalRows);
    console.log("  - X-Export-Timestamp:", hasTimestamp);
    console.log("  - X-Date-Range-Applied:", hasDateRange);
  }
  
  // Test 5: Check validators are imported
  console.log("\nTest 5: Validators imported in routes");
  if (routesContent.includes('from "./validators"')) {
    console.log("✅ PASS: Validators imported");
  } else {
    console.log("❌ FAIL: Validators not imported");
  }
  
  console.log("\n✅ Export guardrail tests complete!\n");
}

async function main() {
  console.log("=".repeat(60));
  console.log("SMARTKLIX CRM HARDENING VALIDATION TEST");
  console.log("=".repeat(60));
  
  await testValidators();
  await testExportGuardrails();
  
  console.log("=".repeat(60));
  console.log("✅ ALL TESTS COMPLETE");
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("1. Seed test data: npx tsx server/seed-utils.ts");
  console.log("2. Start server: npm run dev");
  console.log("3. Test exports via UI: http://localhost:5000/exports");
  console.log("4. Verify metadata headers in browser dev tools");
  console.log("\n");
}

main().catch(console.error);
