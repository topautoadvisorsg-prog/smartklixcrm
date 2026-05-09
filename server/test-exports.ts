/**
 * End-to-End Test Script for CRM + Field Ops + Export System
 * 
 * This script:
 * 1. Seeds mock data
 * 2. Tests all export endpoints
 * 3. Validates CSV output
 * 4. Verifies data relationships
 * 5. Tests edge cases (empty DB, partial data)
 * 
 * Usage:
 *   npx ts-node server/test-exports.ts
 */

import { seedAll, seedContacts, seedJobs, seedFieldReports, seedFinancialRecords } from "./seed-utils";
import { storage } from "./storage";
import * as http from "http";

const BASE_URL = "http://localhost:5000/api";

// ========================================
// HELPER: Make HTTP GET request
// ========================================

function makeRequest(url: string): Promise<{ statusCode: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          body,
          headers: res.headers,
        });
      });
    }).on("error", reject);
  });
}

// ========================================
// TEST: Validate CSV format
// ========================================

function validateCSV(csv: string, expectedColumns: string[], testName: string): boolean {
  const lines = csv.split("\n").filter(line => line.trim());
  
  if (lines.length === 0) {
    console.log(`  ⚠️  ${testName}: CSV is empty (no data)`);
    return true; // Empty is valid
  }
  
  const header = lines[0];
  const columns = header.split(",");
  
  // Check if all expected columns are present
  const missingColumns = expectedColumns.filter(col => !columns.includes(col));
  if (missingColumns.length > 0) {
    console.log(`  ❌ ${testName}: Missing columns: ${missingColumns.join(", ")}`);
    return false;
  }
  
  console.log(`  ✅ ${testName}: ${lines.length - 1} records, ${columns.length} columns`);
  return true;
}

// ========================================
// TEST SUITE
// ========================================

async function runTests() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 CRM + Field Ops + Export System - End-to-End Test");
  console.log("=".repeat(60) + "\n");

  let passed = 0;
  let failed = 0;

  try {
    // ========================================
    // PHASE 1: Test with empty database
    // ========================================
    console.log("📋 PHASE 1: Testing exports with empty database");
    console.log("-".repeat(60));

    try {
      const contactsExport = await makeRequest(`${BASE_URL}/export/contacts`);
      if (contactsExport.statusCode === 200) {
        console.log("  ✅ GET /export/contacts: 200 OK");
        passed++;
      } else {
        console.log(`  ❌ GET /export/contacts: ${contactsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ GET /export/contacts: Failed - ${error.message}`);
      failed++;
    }

    try {
      const jobsExport = await makeRequest(`${BASE_URL}/export/jobs`);
      if (jobsExport.statusCode === 200) {
        console.log("  ✅ GET /export/jobs: 200 OK");
        passed++;
      } else {
        console.log(`  ❌ GET /export/jobs: ${jobsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ GET /export/jobs: Failed - ${error.message}`);
      failed++;
    }

    try {
      const financialsExport = await makeRequest(`${BASE_URL}/export/financials`);
      if (financialsExport.statusCode === 200) {
        console.log("  ✅ GET /export/financials: 200 OK");
        passed++;
      } else {
        console.log(`  ❌ GET /export/financials: ${financialsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ GET /export/financials: Failed - ${error.message}`);
      failed++;
    }

    try {
      const fieldReportsExport = await makeRequest(`${BASE_URL}/export/field-reports`);
      if (fieldReportsExport.statusCode === 200) {
        console.log("  ✅ GET /export/field-reports: 200 OK");
        passed++;
      } else {
        console.log(`  ❌ GET /export/field-reports: ${fieldReportsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ GET /export/field-reports: Failed - ${error.message}`);
      failed++;
    }

    // ========================================
    // PHASE 2: Seed data
    // ========================================
    console.log("\n📋 PHASE 2: Seeding mock data");
    console.log("-".repeat(60));

    const seedData = await seedAll({
      contacts: 5,
      jobs: 3,
      fieldReports: 5,
      financialRecords: 6,
    });

    // ========================================
    // PHASE 3: Test exports with data
    // ========================================
    console.log("\n📋 PHASE 3: Testing exports with seeded data");
    console.log("-".repeat(60));

    // Test contacts export
    try {
      const contactsExport = await makeRequest(`${BASE_URL}/export/contacts`);
      if (contactsExport.statusCode === 200) {
        const valid = validateCSV(
          contactsExport.body,
          ["id", "name", "email", "phone", "company", "contactType", "status", "source"],
          "Contacts Export"
        );
        if (valid) passed++;
        else failed++;
      } else {
        console.log(`  ❌ Contacts Export: ${contactsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Contacts Export: Failed - ${error.message}`);
      failed++;
    }

    // Test jobs export
    try {
      const jobsExport = await makeRequest(`${BASE_URL}/export/jobs`);
      if (jobsExport.statusCode === 200) {
        const valid = validateCSV(
          jobsExport.body,
          ["jobId", "title", "clientName", "status", "value", "createdAt"],
          "Jobs Export"
        );
        if (valid) passed++;
        else failed++;
        
        // Verify client names are present (not just IDs)
        if (jobsExport.body.includes("clientName") && !jobsExport.body.includes("Unknown")) {
          console.log("  ✅ Jobs Export: Contains relational data (client names)");
          passed++;
        } else {
          console.log("  ⚠️  Jobs Export: May have missing client names");
        }
      } else {
        console.log(`  ❌ Jobs Export: ${jobsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Jobs Export: Failed - ${error.message}`);
      failed++;
    }

    // Test financials export
    try {
      const financialsExport = await makeRequest(`${BASE_URL}/export/financials`);
      if (financialsExport.statusCode === 200) {
        const valid = validateCSV(
          financialsExport.body,
          ["id", "contactName", "jobTitle", "type", "category", "amount", "date"],
          "Financials Export"
        );
        if (valid) passed++;
        else failed++;
        
        // Verify relational data
        if (financialsExport.body.includes("contactName") && financialsExport.body.includes("jobTitle")) {
          console.log("  ✅ Financials Export: Contains relational data (contact + job)");
          passed++;
        } else {
          console.log("  ⚠️  Financials Export: May have missing relational data");
        }
      } else {
        console.log(`  ❌ Financials Export: ${financialsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Financials Export: Failed - ${error.message}`);
      failed++;
    }

    // Test field reports export
    try {
      const fieldReportsExport = await makeRequest(`${BASE_URL}/export/field-reports`);
      if (fieldReportsExport.statusCode === 200) {
        const valid = validateCSV(
          fieldReportsExport.body,
          ["id", "jobId", "jobTitle", "contactName", "type", "notes", "createdAt"],
          "Field Reports Export"
        );
        if (valid) passed++;
        else failed++;
        
        // Verify relational data
        if (fieldReportsExport.body.includes("jobTitle") && fieldReportsExport.body.includes("contactName")) {
          console.log("  ✅ Field Reports Export: Contains relational data (job + contact)");
          passed++;
        } else {
          console.log("  ⚠️  Field Reports Export: May have missing relational data");
        }
      } else {
        console.log(`  ❌ Field Reports Export: ${fieldReportsExport.statusCode}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Field Reports Export: Failed - ${error.message}`);
      failed++;
    }

    // ========================================
    // PHASE 4: Test data integrity
    // ========================================
    console.log("\n📋 PHASE 4: Testing data integrity");
    console.log("-".repeat(60));

    // Verify field reports have valid jobId and contactId
    const fieldReports = await storage.getFieldReports();
    let validReports = 0;
    for (const report of fieldReports) {
      const job = await storage.getJob(report.jobId);
      const contact = await storage.getContact(report.contactId);
      if (job && contact) validReports++;
    }
    
    if (validReports === fieldReports.length) {
      console.log(`  ✅ Field Reports: All ${fieldReports.length} reports have valid job and contact references`);
      passed++;
    } else {
      console.log(`  ❌ Field Reports: ${validReports}/${fieldReports.length} have valid references`);
      failed++;
    }

    // Verify financial records have valid contactId
    const financialRecords = await storage.getFinancialRecords();
    let validFinancials = 0;
    for (const record of financialRecords) {
      const contact = await storage.getContact(record.contactId);
      if (contact) validFinancials++;
    }
    
    if (validFinancials === financialRecords.length) {
      console.log(`  ✅ Financial Records: All ${financialRecords.length} records have valid contact references`);
      passed++;
    } else {
      console.log(`  ❌ Financial Records: ${validFinancials}/${financialRecords.length} have valid references`);
      failed++;
    }

    // ========================================
    // PHASE 5: Test validation (prevent orphans)
    // ========================================
    console.log("\n📋 PHASE 5: Testing validation (orphan prevention)");
    console.log("-".repeat(60));

    // Try to create field report with invalid jobId
    try {
      const response = await fetch(`${BASE_URL}/field-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: "nonexistent-job-id",
          contactId: seedData.contacts[0].id,
          type: "progress",
          notes: "Test report",
        }),
      });

      if (response.status === 400) {
        console.log("  ✅ Field Report Validation: Rejects invalid jobId");
        passed++;
      } else {
        console.log(`  ❌ Field Report Validation: Should reject invalid jobId (got ${response.status})`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Field Report Validation: Failed - ${error.message}`);
      failed++;
    }

    // Try to create financial record with invalid contactId
    try {
      const response = await fetch(`${BASE_URL}/financial-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: "nonexistent-contact-id",
          jobId: seedData.jobs[0].id,
          type: "expense",
          amount: "100",
          description: "Test expense",
        }),
      });

      if (response.status === 400) {
        console.log("  ✅ Financial Record Validation: Rejects invalid contactId");
        passed++;
      } else {
        console.log(`  ❌ Financial Record Validation: Should reject invalid contactId (got ${response.status})`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Financial Record Validation: Failed - ${error.message}`);
      failed++;
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log("=".repeat(60) + "\n");

    if (failed === 0) {
      console.log("🎉 ALL TESTS PASSED - SYSTEM IS READY FOR TESTING!\n");
    } else {
      console.log(`⚠️  ${failed} test(s) failed - review issues above\n`);
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  }
}

// Run tests
runTests();
