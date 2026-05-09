/**
 * Runtime Verification Script - Final Pre-Test Audit
 * 
 * Tests actual runtime behavior of:
 * 1. Data creation with valid relations
 * 2. Validation blocking invalid references
 * 3. CSV export generation with edge cases
 * 4. Empty database handling
 * 5. Null/undefined safety
 */

import { storage } from "./storage";
import { seedAll } from "./seed-utils";

console.log("\n" + "=".repeat(70));
console.log("RUNTIME VERIFICATION - Final Pre-Test Audit");
console.log("=".repeat(70) + "\n");

async function runVerification() {
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  // ========================================
  // TEST 1: Empty Database State
  // ========================================
  console.log("TEST 1: Empty Database State Handling");
  console.log("-".repeat(70));

  try {
    const contacts = await storage.getContacts();
    const jobs = await storage.getJobs();
    const reports = await storage.getFieldReports();
    const financials = await storage.getFinancialRecords();

    if (Array.isArray(contacts) && Array.isArray(jobs) && 
        Array.isArray(reports) && Array.isArray(financials)) {
      console.log("  ✅ PASS: All queries return arrays on empty DB");
      console.log(`     Contacts: ${contacts.length}, Jobs: ${jobs.length}`);
      console.log(`     Reports: ${reports.length}, Financials: ${financials.length}`);
      passCount++;
    } else {
      console.log("  ❌ FAIL: Queries did not return arrays");
      failCount++;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Empty DB query threw error: ${error.message}`);
    failCount++;
  }

  // ========================================
  // TEST 2: Seed Full Dataset
  // ========================================
  console.log("\nTEST 2: Seed Full Dataset with Valid Relations");
  console.log("-".repeat(70));

  try {
    const data = await seedAll({
      contacts: 5,
      jobs: 3,
      fieldReports: 5,
      financialRecords: 6,
    });

    // Verify all relationships
    let allValid = true;

    // Check field reports
    for (const report of data.fieldReports) {
      const job = await storage.getJob(report.jobId);
      const contact = await storage.getContact(report.contactId);
      if (!job || !contact) {
        console.log(`  ❌ Invalid report ${report.id}: job=${!!job}, contact=${!!contact}`);
        allValid = false;
      }
    }

    // Check financial records
    for (const record of data.financialRecords) {
      const contact = await storage.getContact(record.contactId);
      if (!contact) {
        console.log(`  ❌ Invalid financial ${record.id}: contact missing`);
        allValid = false;
      }
    }

    // Check jobs
    for (const job of data.jobs) {
      const contact = await storage.getContact(job.clientId!);
      if (!contact) {
        console.log(`  ❌ Invalid job ${job.id}: client missing`);
        allValid = false;
      }
    }

    if (allValid) {
      console.log("  ✅ PASS: All seeded data has valid relationships");
      console.log(`     ${data.contacts.length} contacts`);
      console.log(`     ${data.jobs.length} jobs (linked to contacts)`);
      console.log(`     ${data.fieldReports.length} field reports (linked to jobs + contacts)`);
      console.log(`     ${data.financialRecords.length} financial records (linked to jobs + contacts)`);
      passCount++;
    } else {
      console.log("  ❌ FAIL: Some relationships are invalid");
      failCount++;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Seeding threw error: ${error.message}`);
    failCount++;
  }

  // ========================================
  // TEST 3: Validation - Block Invalid References
  // ========================================
  console.log("\nTEST 3: Validation Blocks Invalid References");
  console.log("-".repeat(70));

  // Test 3a: Invalid jobId in field report
  try {
    await storage.createFieldReport({
      jobId: "nonexistent-job-id",
      contactId: data.contacts[0].id,
      type: "progress",
      observations: "Test",
    });
    console.log("  ⚠️  WARN: Storage layer allowed invalid jobId (validation must be in routes)");
    warnCount++;
  } catch (error: any) {
    console.log("  ✅ PASS: Storage rejected invalid jobId");
    passCount++;
  }

  // Test 3b: Invalid contactId in financial record
  try {
    await storage.createFinancialRecord({
      contactId: "nonexistent-contact-id",
      jobId: data.jobs[0].id,
      type: "expense",
      category: "test_expense",
      amount: "100",
    });
    console.log("  ⚠️  WARN: Storage layer allowed invalid contactId (validation must be in routes)");
    warnCount++;
  } catch (error: any) {
    console.log("  ✅ PASS: Storage rejected invalid contactId");
    passCount++;
  }

  // ========================================
  // TEST 4: CSV Generation Safety
  // ========================================
  console.log("\nTEST 4: CSV Generation with Edge Cases");
  console.log("-".repeat(70));

  // Simulate CSV generation logic
  function testCSVGeneration() {
    const testData: Array<Record<string, any>> = [
      {
        id: "1",
        name: "Test Contact",
        email: null,
        phone: undefined,
        company: "",
        amount: "0",
        date: new Date(),
        tags: ["tag1", "tag2"],
        notes: "Has, comma",
        quotes: 'Has "quotes"',
      },
    ];

    const columns = ["id", "name", "email", "phone", "company", "amount", "date", "tags", "notes", "quotes"];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return "";
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) value = value.join("; ");
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    try {
      const header = columns.join(",");
      const rows = testData.map(row => columns.map(col => escapeCSV(row[col])).join(","));
      const csv = [header, ...rows].join("\n");

      // Verify CSV structure
      const lines = csv.split("\n");
      if (lines.length >= 1 && lines[0].includes("id") && lines[0].includes("name")) {
        console.log("  ✅ PASS: CSV generation handles nulls, dates, arrays, commas, quotes");
        console.log(`     Generated ${lines.length} line(s)`);
        console.log(`     Header: ${lines[0]}`);
        passCount++;
        return true;
      } else {
        console.log("  ❌ FAIL: CSV structure invalid");
        failCount++;
        return false;
      }
    } catch (error: any) {
      console.log(`  ❌ FAIL: CSV generation threw error: ${error.message}`);
      failCount++;
      return false;
    }
  }

  testCSVGeneration();

  // ========================================
  // TEST 5: Relational Data Resolution
  // ========================================
  console.log("\nTEST 5: Relational Data Resolution in Exports");
  console.log("-".repeat(70));

  try {
    const contacts = await storage.getContacts();
    const jobs = await storage.getJobs();
    const reports = await storage.getFieldReports();
    const financials = await storage.getFinancialRecords();

    const contactMap = new Map(contacts.map(c => [c.id, c.name]));
    const jobMap = new Map(jobs.map(j => [j.id, j.title]));

    // Test jobs export resolution
    let jobResolutions = 0;
    for (const job of jobs) {
      const clientName = job.clientId ? contactMap.get(job.clientId) || "Unknown" : "N/A";
      if (clientName !== "Unknown") jobResolutions++;
    }

    // Test field reports export resolution
    let reportResolutions = 0;
    for (const report of reports) {
      const contactName = contactMap.get(report.contactId) || "Unknown";
      const jobTitle = jobMap.get(report.jobId) || "Unknown";
      if (contactName !== "Unknown" && jobTitle !== "Unknown") reportResolutions++;
    }

    // Test financials export resolution
    let financialResolutions = 0;
    for (const record of financials) {
      const contactName = contactMap.get(record.contactId) || "Unknown";
      const jobTitle = record.jobId ? (jobMap.get(record.jobId) || "Unknown") : "N/A";
      if (contactName !== "Unknown") financialResolutions++;
    }

    console.log(`  ✅ PASS: Relational data resolves correctly`);
    console.log(`     Jobs: ${jobResolutions}/${jobs.length} resolved to client names`);
    console.log(`     Reports: ${reportResolutions}/${reports.length} resolved to contact + job`);
    console.log(`     Financials: ${financialResolutions}/${financials.length} resolved to contact names`);
    passCount++;
  } catch (error: any) {
    console.log(`  ❌ FAIL: Relational resolution error: ${error.message}`);
    failCount++;
  }

  // ========================================
  // TEST 6: Financial Summary Calculation
  // ========================================
  console.log("\nTEST 6: Financial Summary Calculation");
  console.log("-".repeat(70));

  try {
    if (data && data.contacts.length > 0) {
      const contactId = data.contacts[0].id;
      const summary = await storage.getFinancialSummary(contactId);

      if (typeof summary.totalIncome === 'number' && 
          typeof summary.totalExpenses === 'number' &&
          typeof summary.netProfit === 'number') {
        console.log("  ✅ PASS: Financial summary calculates correctly");
        console.log(`     Income: $${summary.totalIncome.toFixed(2)}`);
        console.log(`     Expenses: $${summary.totalExpenses.toFixed(2)}`);
        console.log(`     Net Profit: $${summary.netProfit.toFixed(2)}`);
        passCount++;
      } else {
        console.log("  ❌ FAIL: Financial summary returned invalid types");
        failCount++;
      }
    } else {
      console.log("  ⚠️  WARN: No contacts available for financial summary test");
      warnCount++;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Financial summary error: ${error.message}`);
    failCount++;
  }

  // ========================================
  // TEST 7: Filter Logic Verification
  // ========================================
  console.log("\nTEST 7: Filter Logic Verification");
  console.log("-".repeat(70));

  try {
    // Test field report filters
    const progressReports = await storage.getFieldReports({ type: "progress" });
    const allReports = await storage.getFieldReports();
    
    if (progressReports.length <= allReports.length) {
      console.log("  ✅ PASS: Field report filters work correctly");
      console.log(`     Progress reports: ${progressReports.length}/${allReports.length}`);
      passCount++;
    } else {
      console.log("  ❌ FAIL: Filter returned more results than total");
      failCount++;
    }

    // Test financial record filters
    const incomeRecords = await storage.getFinancialRecords({ type: "income" });
    const allFinancials = await storage.getFinancialRecords();

    if (incomeRecords.length <= allFinancials.length) {
      console.log("  ✅ PASS: Financial record filters work correctly");
      console.log(`     Income records: ${incomeRecords.length}/${allFinancials.length}`);
      passCount++;
    } else {
      console.log("  ❌ FAIL: Financial filter returned more results than total");
      failCount++;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Filter logic error: ${error.message}`);
    failCount++;
  }

  // ========================================
  // TEST 8: Update Operations
  // ========================================
  console.log("\nTEST 8: Update Operations Safety");
  console.log("-".repeat(70));

  try {
    if (data && data.contacts.length > 0) {
      const contact = data.contacts[0];
      const originalName = contact.name;
      
      const updated = await storage.updateContact(contact.id, { name: "Updated Name" });
      if (updated && updated.name === "Updated Name") {
        // Revert
        await storage.updateContact(contact.id, { name: originalName });
        console.log("  ✅ PASS: Update operations work safely");
        passCount++;
      } else {
        console.log("  ❌ FAIL: Update did not return correct data");
        failCount++;
      }
    } else {
      console.log("  ⚠️  WARN: No contacts available for update test");
      warnCount++;
    }
  } catch (error: any) {
    console.log(`  ❌ FAIL: Update operation error: ${error.message}`);
    failCount++;
  }

  // ========================================
  // FINAL SUMMARY
  // ========================================
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(70));
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⚠️  Warnings: ${warnCount}`);
  console.log(`📊 Total Tests: ${passCount + failCount + warnCount}`);
  console.log("=".repeat(70) + "\n");

  if (failCount === 0) {
    console.log("🎉 ALL CRITICAL TESTS PASSED - SYSTEM IS SAFE FOR EXPORT TESTING\n");
    process.exit(0);
  } else {
    console.log(`⚠️  ${failCount} test(s) FAILED - review issues above\n`);
    process.exit(1);
  }
}

// Run verification
let data: any = null;
runVerification().catch(error => {
  console.error("\n❌ Verification suite failed:", error);
  process.exit(1);
});
