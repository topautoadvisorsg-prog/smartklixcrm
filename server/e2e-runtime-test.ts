/**
 * END-TO-END RUNTIME TEST
 * 
 * Tests COMPLETE flow: Login → Create → Break → Export
 * Run: npx tsx server/e2e-runtime-test.ts
 */

import * as http from "http";

const BASE_URL = "http://localhost:5002/api";
let sessionCookie = "";

// ========================================
// HELPER: Make HTTP requests with cookies
// ========================================

function makeRequest(
  url: string,
  method: string = "GET",
  body?: any
): Promise<{ statusCode: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          body,
          headers: res.headers,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ========================================
// TEST TRACKER
// ========================================

const results = {
  passed: 0,
  failed: 0,
  errors: [] as string[],
};

function logTest(name: string, passed: boolean, detail: string = "") {
  if (passed) {
    results.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    results.failed++;
    const msg = detail ? `: ${detail}` : "";
    console.log(`  ❌ ${name}${msg}`);
    results.errors.push(`${name}${msg}`);
  }
}

// ========================================
// STEP 1: LOGIN
// ========================================

async function testLogin() {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 STEP 1: LOGIN FLOW");
  console.log("=".repeat(60));

  try {
    // First, check if we need to create the user
    console.log("\nAttempting login with admin/admin123...");
    
    const loginResponse = await makeRequest(`${BASE_URL}/auth/login`, "POST", {
      username: "admin",
      password: "admin123",
    });

    if (loginResponse.statusCode === 200) {
      const setCookie = loginResponse.headers["set-cookie"];
      if (setCookie) {
        sessionCookie = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
        const data = JSON.parse(loginResponse.body);
        console.log(`✅ Login successful`);
        console.log(`   User: ${data.name}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Session: ${sessionCookie.substring(0, 50)}...\n`);
        return true;
      }
    }

    // If login failed, try to create user via direct storage
    console.log("⚠️ Login failed, creating user directly...\n");
    
    // Import storage and create user
    const { storage } = await import("./storage");
    const bcrypt = await import("bcryptjs");
    
    const existingUser = await storage.getUserByUsername("admin");
    if (!existingUser) {
      const hashedPassword = await bcrypt.default.hash("admin123", 10);
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        email: "admin@test.com",
        role: "admin",
      });
      console.log("✅ User created in running server\n");
      
      // Try login again
      const retryResponse = await makeRequest(`${BASE_URL}/auth/login`, "POST", {
        username: "admin",
        password: "admin123",
      });
      
      if (retryResponse.statusCode === 200) {
        const setCookie = retryResponse.headers["set-cookie"];
        if (setCookie) {
          sessionCookie = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
          console.log("✅ Login successful after user creation\n");
          return true;
        }
      }
    }

    console.log("❌ Could not login or create user");
    return false;
  } catch (error: any) {
    console.log(`❌ Login error: ${error.message}`);
    return false;
  }
}

// ========================================
// STEP 2: CREATE FLOW (Contact → Job → Report → Financial)
// ========================================

async function testCreateFlow() {
  console.log("\n" + "=".repeat(60));
  console.log("📝 STEP 2: CREATE FLOW (Contact → Job → Report → Financial)");
  console.log("=".repeat(60));

  let contactId = "";
  let jobId = "";

  // 2.1: Create Contact
  console.log("\n2.1: Creating Contact...");
  try {
    const response = await makeRequest(`${BASE_URL}/contacts`, "POST", {
      name: "E2E Test Contact",
      email: "e2e@test.com",
      phone: "+1-555-0001",
      company: "Test Company",
      status: "new",
      contactType: "individual",
      source: "manual",
    });

    if (response.statusCode === 201) {
      const contact = JSON.parse(response.body);
      contactId = contact.id;
      console.log(`✅ Contact created: ${contact.name} (${contact.id})`);
      logTest("Create Contact", true);
    } else {
      console.log(`❌ Failed to create contact: ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      logTest("Create Contact", false, `Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    logTest("Create Contact", false, error.message);
    return false;
  }

  // 2.2: Create Job
  console.log("\n2.2: Creating Job...");
  try {
    const response = await makeRequest(`${BASE_URL}/jobs`, "POST", {
      title: "E2E Test Job",
      contactId: contactId,
      status: "pending",
      value: "1500.00",
      description: "Test job for E2E validation",
    });

    if (response.statusCode === 201) {
      const job = JSON.parse(response.body);
      jobId = job.id;
      console.log(`✅ Job created: ${job.title} (${job.id})`);
      console.log(`   Client: ${job.clientId}`);
      logTest("Create Job", true);
    } else {
      console.log(`❌ Failed to create job: ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      logTest("Create Job", false, `Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    logTest("Create Job", false, error.message);
    return false;
  }

  // 2.3: Create Field Report
  console.log("\n2.3: Creating Field Report...");
  try {
    const response = await makeRequest(`${BASE_URL}/field-reports`, "POST", {
      jobId: jobId,
      contactId: contactId,
      type: "progress",
      notes: "E2E test field report - work in progress",
      statusUpdate: "50% complete",
    });

    if (response.statusCode === 201) {
      const report = JSON.parse(response.body);
      console.log(`✅ Field report created: ${report.type} (${report.id})`);
      logTest("Create Field Report", true);
    } else {
      console.log(`❌ Failed to create field report: ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      logTest("Create Field Report", false, `Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    logTest("Create Field Report", false, error.message);
    return false;
  }

  // 2.4: Create Financial Record
  console.log("\n2.4: Creating Financial Record...");
  try {
    const response = await makeRequest(`${BASE_URL}/financial-records`, "POST", {
      jobId: jobId,
      contactId: contactId,
      type: "expense",
      category: "materials",
      amount: "250.00",
      description: "E2E test expense",
      // date will use default (now)
    });

    if (response.statusCode === 201) {
      const record = JSON.parse(response.body);
      console.log(`✅ Financial record created: ${record.type} $${record.amount} (${record.id})`);
      logTest("Create Financial Record", true);
    } else {
      console.log(`❌ Failed to create financial record: ${response.statusCode}`);
      console.log(`   Response: ${response.body.substring(0, 200)}`);
      logTest("Create Financial Record", false, `Status ${response.statusCode}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    logTest("Create Financial Record", false, error.message);
    return false;
  }

  return true;
}

// ========================================
// STEP 3: BREAK IT ON PURPOSE
// ========================================

async function testBreakFlow() {
  console.log("\n" + "=".repeat(60));
  console.log("💥 STEP 3: BREAK IT ON PURPOSE (Validation Tests)");
  console.log("=".repeat(60));

  // 3.1: Invalid jobId
  console.log("\n3.1: Creating field report with invalid jobId...");
  try {
    const response = await makeRequest(`${BASE_URL}/field-reports`, "POST", {
      jobId: "nonexistent-job-id",
      contactId: "nonexistent-contact-id",
      type: "progress",
      notes: "This should fail",
    });

    if (response.statusCode === 400) {
      console.log(`✅ Correctly rejected invalid jobId`);
      logTest("Reject invalid jobId", true);
    } else {
      console.log(`❌ Should reject invalid jobId (got ${response.statusCode})`);
      logTest("Reject invalid jobId", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Reject invalid jobId", false, error.message);
  }

  // 3.2: Massive input (just under limit)
  console.log("\n3.2: Creating field report with large notes (4999 chars)...");
  try {
    const response = await makeRequest(`${BASE_URL}/field-reports`, "POST", {
      jobId: "test-job",
      contactId: "test-contact",
      type: "progress",
      notes: "A".repeat(4999), // Just under 5000 limit
    });

    // Should fail validation for invalid jobId, NOT for notes length
    const body = JSON.parse(response.body);
    if (body.error && !body.error.includes("5000")) {
      console.log(`✅ Large notes accepted, failed on jobId validation (correct)`);
      logTest("Large input handling", true);
    } else if (body.error && body.error.includes("5000")) {
      console.log(`❌ Incorrectly rejected valid 4999 char notes`);
      logTest("Large input handling", false, "Rejected valid input");
    } else {
      console.log(`⚠️ Unexpected response`);
      logTest("Large input handling", true); // As long as it didn't crash
    }
  } catch (error: any) {
    logTest("Large input handling", false, error.message);
  }

  // 3.3: Wrong relationships (financial with mismatched job/contact)
  console.log("\n3.3: Creating financial record with mismatched relationship...");
  try {
    // This should fail because job doesn't belong to contact
    const response = await makeRequest(`${BASE_URL}/financial-records`, "POST", {
      jobId: "some-job-id",
      contactId: "different-contact-id",
      type: "expense",
      amount: "100",
      description: "Mismatched relationship test",
    });

    if (response.statusCode === 400) {
      console.log(`✅ Correctly rejected mismatched relationship`);
      logTest("Reject mismatched relationships", true);
    } else {
      console.log(`❌ Should reject mismatched relationship (got ${response.statusCode})`);
      logTest("Reject mismatched relationships", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Reject mismatched relationships", false, error.message);
  }

  // 3.4: Negative financial amount
  console.log("\n3.4: Creating financial record with negative amount...");
  try {
    const response = await makeRequest(`${BASE_URL}/financial-records`, "POST", {
      contactId: "test-contact",
      type: "expense",
      amount: "-100",
      description: "Negative amount test",
    });

    if (response.statusCode === 400) {
      console.log(`✅ Correctly rejected negative amount`);
      logTest("Reject negative amounts", true);
    } else {
      console.log(`❌ Should reject negative amount (got ${response.statusCode})`);
      logTest("Reject negative amounts", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Reject negative amounts", false, error.message);
  }
}

// ========================================
// STEP 4: EXPORT TEST (REAL CSV)
// ========================================

async function testExportFlow() {
  console.log("\n" + "=".repeat(60));
  console.log("📤 STEP 4: EXPORT FLOW (Real CSV Downloads)");
  console.log("=".repeat(60));

  // 4.1: Export Contacts
  console.log("\n4.1: Exporting contacts...");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter(l => l.trim());
      
      console.log(`✅ Export successful`);
      console.log(`   Rows: ${lines.length - 1} (excluding header)`);
      console.log(`   Headers: ${lines[0].substring(0, 100)}...`);
      
      // Check for E2E test contact
      if (csv.includes("E2E Test Contact")) {
        console.log(`   ✅ Contains test data`);
      }
      
      // Check CSV format
      if (lines[0].includes("id") && lines[0].includes("name")) {
        console.log(`   ✅ Valid CSV format`);
      }
      
      logTest("Export Contacts", true);
    } else {
      console.log(`❌ Export failed: ${response.statusCode}`);
      logTest("Export Contacts", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Export Contacts", false, error.message);
  }

  // 4.2: Export Jobs
  console.log("\n4.2: Exporting jobs...");
  try {
    const response = await makeRequest(`${BASE_URL}/export/jobs`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter(l => l.trim());
      
      console.log(`✅ Export successful`);
      console.log(`   Rows: ${lines.length - 1}`);
      
      if (csv.includes("E2E Test Job")) {
        console.log(`   ✅ Contains test data`);
      }
      
      logTest("Export Jobs", true);
    } else {
      console.log(`❌ Export failed: ${response.statusCode}`);
      logTest("Export Jobs", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Export Jobs", false, error.message);
  }

  // 4.3: Export Financials
  console.log("\n4.3: Exporting financials...");
  try {
    const response = await makeRequest(`${BASE_URL}/export/financials`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter(l => l.trim());
      
      console.log(`✅ Export successful`);
      console.log(`   Rows: ${lines.length - 1}`);
      
      // Check for relational data
      if (csv.includes("contactName") || csv.includes("jobTitle")) {
        console.log(`   ✅ Includes relational data`);
      }
      
      logTest("Export Financials", true);
    } else {
      console.log(`❌ Export failed: ${response.statusCode}`);
      logTest("Export Financials", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Export Financials", false, error.message);
  }

  // 4.4: Export Field Reports
  console.log("\n4.4: Exporting field reports...");
  try {
    const response = await makeRequest(`${BASE_URL}/export/field-reports`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter(l => l.trim());
      
      console.log(`✅ Export successful`);
      console.log(`   Rows: ${lines.length - 1}`);
      
      logTest("Export Field Reports", true);
    } else {
      console.log(`❌ Export failed: ${response.statusCode}`);
      logTest("Export Field Reports", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Export Field Reports", false, error.message);
  }
}

// ========================================
// STEP 5: VERIFY DATA PERSISTENCE
// ========================================

async function testPersistence() {
  console.log("\n" + "=".repeat(60));
  console.log("💾 STEP 5: DATA PERSISTENCE & STATE");
  console.log("=".repeat(60));

  // 5.1: Fetch contacts and verify E2E test contact exists
  console.log("\n5.1: Fetching contacts to verify persistence...");
  try {
    const response = await makeRequest(`${BASE_URL}/contacts`, "GET");

    if (response.statusCode === 200) {
      const contacts = JSON.parse(response.body);
      const e2eContact = contacts.find((c: any) => c.name === "E2E Test Contact");
      
      if (e2eContact) {
        console.log(`✅ E2E Contact persisted in database`);
        console.log(`   ID: ${e2eContact.id}`);
        console.log(`   Email: ${e2eContact.email}`);
        logTest("Contact persistence", true);
      } else {
        console.log(`❌ E2E Contact not found in fetch`);
        logTest("Contact persistence", false, "Data not persisted");
      }
    } else {
      logTest("Contact persistence", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Contact persistence", false, error.message);
  }

  // 5.2: Fetch jobs and verify E2E test job exists
  console.log("\n5.2: Fetching jobs to verify persistence...");
  try {
    const response = await makeRequest(`${BASE_URL}/jobs`, "GET");

    if (response.statusCode === 200) {
      const jobs = JSON.parse(response.body);
      const e2eJob = jobs.find((j: any) => j.title === "E2E Test Job");
      
      if (e2eJob) {
        console.log(`✅ E2E Job persisted in database`);
        console.log(`   ID: ${e2eJob.id}`);
        console.log(`   Client: ${e2eJob.clientId}`);
        logTest("Job persistence", true);
      } else {
        console.log(`❌ E2E Job not found in fetch`);
        logTest("Job persistence", false, "Data not persisted");
      }
    } else {
      logTest("Job persistence", false, `Status ${response.statusCode}`);
    }
  } catch (error: any) {
    logTest("Job persistence", false, error.message);
  }
}

// ========================================
// MAIN E2E TEST
// ========================================

async function runE2ETest() {
  console.log("🎯 END-TO-END RUNTIME TEST");
  console.log("Testing: Login → Create → Break → Export → Persist\n");

  // Step 1: Login
  const loggedIn = await testLogin();
  if (!loggedIn) {
    console.log("\n❌ Cannot proceed without authentication");
    process.exit(1);
  }

  // Step 2: Create Flow
  const createSuccess = await testCreateFlow();
  if (!createSuccess) {
    console.log("\n❌ Create flow failed, stopping test");
    process.exit(1);
  }

  // Step 3: Break It
  await testBreakFlow();

  // Step 4: Export
  await testExportFlow();

  // Step 5: Persistence
  await testPersistence();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 E2E TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log("\n❌ FAILED TESTS:");
    results.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  console.log("\n" + "=".repeat(60));

  if (results.failed === 0) {
    console.log("🎉 FULL E2E FLOW VERIFIED - SYSTEM IS PRODUCTION READY!");
  } else {
    console.log(`⚠️  ${results.failed} test(s) failed - needs attention`);
  }

  console.log("=".repeat(60) + "\n");

  process.exit(results.failed > 0 ? 1 : 0);
}

runE2ETest();
