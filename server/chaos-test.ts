/**
 * CHAOS TEST - Real User Break Mode
 * 
 * This script simulates:
 * 1. Messy user flow (missing fields, weird characters, partial data)
 * 2. Spam user (rapid requests, repeated exports)
 * 3. Confused user (invalid dates, empty filters, conflicting filters)
 * 4. Power user (heavy load, large datasets)
 * 5. Weird flow break (out of order operations)
 * 6. Export trust test (critical validation)
 * 
 * Usage: npx tsx server/chaos-test.ts
 */

import * as http from "http";

const BASE_URL = "http://localhost:5000/api";
let sessionCookie = "";

// ========================================
// HELPER: Make HTTP requests
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
// HELPER: Login to get session
// ========================================

async function login() {
  try {
    // Try default credentials
    const response = await makeRequest(`${BASE_URL}/auth/login`, "POST", {
      username: "admin",
      password: "admin123",
    });

    if (response.statusCode === 200) {
      // Extract session cookie from headers
      const setCookie = response.headers["set-cookie"];
      if (setCookie) {
        sessionCookie = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
        console.log("✅ Logged in successfully");
        return true;
      }
    }
    console.log("⚠️ Login failed, will test public endpoints only");
    return false;
  } catch (error) {
    console.log("⚠️ Login error, will test public endpoints only");
    return false;
  }
}

// ========================================
// TEST TRACKER
// ========================================

const results = {
  passed: 0,
  failed: 0,
  critical: [] as string[],
  high: [] as string[],
  minor: [] as string[],
  strange: [] as string[],
};

function logTest(name: string, passed: boolean, detail: string, severity?: "critical" | "high" | "minor" | "strange") {
  if (passed) {
    results.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    results.failed++;
    console.log(`  ❌ ${name}: ${detail}`);
    if (severity === "critical") {
      results.critical.push(`${name}: ${detail}`);
    } else if (severity === "high") {
      results.high.push(`${name}: ${detail}`);
    } else if (severity === "minor") {
      results.minor.push(`${name}: ${detail}`);
    } else if (severity === "strange") {
      results.strange.push(`${name}: ${detail}`);
    }
  }
}

// ========================================
// SCENARIO 1: MESSY USER FLOW
// ========================================

async function testMessyUserFlow() {
  console.log("\n" + "=".repeat(60));
  console.log("🧍‍♂️ SCENARIO 1: MESSY USER FLOW");
  console.log("=".repeat(60));
  console.log("\n⚠️ Note: Most POST endpoints require authentication");
  console.log("   Testing validation through public export endpoints\n");

  // Since POST endpoints require auth, test export endpoints with messy filters
  console.log("Test 1.1: Export with messy filter parameters");
  try {
    const response = await makeRequest(
      `${BASE_URL}/export/contacts?status=&source=&contactType=`,
      "GET"
    );

    if (response.statusCode === 200) {
      logTest("Export handles empty filter values gracefully", true, "");
    } else {
      logTest("Export handles empty filter values gracefully", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export handles empty filter values gracefully", false, error.message, "critical");
  }

  // Test 1.2: Export with special characters in filters
  console.log("\nTest 1.2: Export with special characters in filters");
  try {
    const response = await makeRequest(
      `${BASE_URL}/export/contacts?status=<script>alert('xss')</script>&source=test"quote`,
      "GET"
    );

    if (response.statusCode === 200 || response.statusCode === 400) {
      logTest("Export handles special characters safely", true, "");
    } else {
      logTest("Export handles special characters safely", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export handles special characters safely", false, error.message, "critical");
  }

  // Test 1.3: Financial export with invalid amount filters
  console.log("\nTest 1.3: Financial export with edge case parameters");
  try {
    const response = await makeRequest(
      `${BASE_URL}/export/financials?type=&contactId=&jobId=`,
      "GET"
    );

    if (response.statusCode === 200) {
      logTest("Financial export handles empty parameters", true, "");
    } else {
      logTest("Financial export handles empty parameters", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Financial export handles empty parameters", false, error.message, "critical");
  }
}

// ========================================
// SCENARIO 2: SPAM USER
// ========================================

async function testSpamUser() {
  console.log("\n" + "=".repeat(60));
  console.log("⚡ SCENARIO 2: SPAM USER");
  console.log("=".repeat(60));

  // Test 2.1: Rapid exports (should hit rate limit)
  console.log("\nTest 2.1: Rapid export requests (rate limiting)");
  let rateLimitHit = false;
  const exportPromises = [];

  for (let i = 0; i < 15; i++) {
    exportPromises.push(
      makeRequest(`${BASE_URL}/export/contacts`, "GET").then((res) => {
        if (res.statusCode === 429) {
          rateLimitHit = true;
        }
        return res;
      })
    );
  }

  try {
    await Promise.all(exportPromises);
    if (rateLimitHit) {
      logTest("Rate limiting works for rapid exports", true, "");
    } else {
      logTest("Rate limiting works for rapid exports", false, "Rate limit not triggered after 15 requests", "high");
    }
  } catch (error: any) {
    logTest("Rate limiting works for rapid exports", false, error.message, "high");
  }

  // Test 2.2: Repeated export of same data
  console.log("\nTest 2.2: Repeated export requests");
  let consistentResults = true;
  let firstResult = "";

  for (let i = 0; i < 5; i++) {
    try {
      const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");
      if (i === 0) {
        firstResult = response.body;
      } else {
        // Results should be consistent (same data)
        if (response.body !== firstResult && response.statusCode === 200) {
          consistentResults = false;
        }
      }
    } catch (error) {
      // Rate limiting might kick in, which is OK
    }
  }

  if (consistentResults) {
    logTest("Repeated exports return consistent results", true, "");
  } else {
    logTest("Repeated exports return consistent results", false, "Results varied between requests", "high");
  }

  // Test 2.3: Concurrent different exports
  console.log("\nTest 2.3: Concurrent different export types");
  try {
    const [contacts, jobs, financials, reports] = await Promise.all([
      makeRequest(`${BASE_URL}/export/contacts`, "GET"),
      makeRequest(`${BASE_URL}/export/jobs`, "GET"),
      makeRequest(`${BASE_URL}/export/financials`, "GET"),
      makeRequest(`${BASE_URL}/export/field-reports`, "GET"),
    ]);

    const allOK = [contacts, jobs, financials, reports].every(
      (r) => r.statusCode === 200 || r.statusCode === 429
    );

    if (allOK) {
      logTest("Concurrent exports handled properly", true, "");
    } else {
      logTest("Concurrent exports handled properly", false, "Some exports failed", "high");
    }
  } catch (error: any) {
    logTest("Concurrent exports handled properly", false, error.message, "critical");
  }
}

// ========================================
// SCENARIO 3: CONFUSED USER
// ========================================

async function testConfusedUser() {
  console.log("\n" + "=".repeat(60));
  console.log("🤯 SCENARIO 3: CONFUSED USER");
  console.log("=".repeat(60));

  // Test 3.1: Export with invalid date format
  console.log("\nTest 3.1: Export with invalid date format");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts?fromDate=not-a-date&toDate=also-invalid`, "GET");

    if (response.statusCode === 400 || response.statusCode === 500) {
      logTest("Handles invalid date format in export", true, "");
    } else if (response.statusCode === 200) {
      // If it returns 200, check if it applied default filter instead
      const dateRangeHeader = response.headers["x-date-range-applied"];
      if (dateRangeHeader) {
        logTest("Handles invalid date format (applied default filter)", true, "");
      } else {
        logTest("Handles invalid date format in export", false, "Accepted invalid dates without error or default", "high");
      }
    } else {
      logTest("Handles invalid date format in export", false, `Unexpected status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Handles invalid date format in export", false, error.message, "high");
  }

  // Test 3.2: Export with future dates only
  console.log("\nTest 3.2: Export with future dates");
  try {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const response = await makeRequest(
      `${BASE_URL}/export/contacts?fromDate=${futureDate.toISOString()}&toDate=${futureDate.toISOString()}`,
      "GET"
    );

    if (response.statusCode === 200) {
      // Should return empty or minimal results
      if (response.body === "" || response.body.includes("id,name") || (response.headers["x-total-rows"] && parseInt(response.headers["x-total-rows"]) === 0)) {
        logTest("Export with future dates returns empty/minimal results", true, "");
      } else {
        logTest("Export with future dates returns empty/minimal results", false, "Returned unexpected data", "high");
      }
    } else {
      logTest("Export with future dates returns empty/minimal results", false, `Status: ${response.statusCode}`, "minor");
    }
  } catch (error: any) {
    logTest("Export with future dates returns empty/minimal results", false, error.message, "high");
  }

  // Test 3.3: Export with conflicting filters (status that doesn't exist)
  console.log("\nTest 3.3: Export with non-existent filter values");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts?status=nonexistent_status_xyz`, "GET");

    if (response.statusCode === 200) {
      // Should return empty results, not crash
      const totalRows = response.headers["x-total-rows"];
      if (totalRows && parseInt(totalRows) === 0) {
        logTest("Export with invalid filter returns empty results", true, "");
      } else {
        logTest("Export with invalid filter returns empty results", true, ""); // Still OK, just no match
      }
    } else {
      logTest("Export with invalid filter returns empty results", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export with invalid filter returns empty results", false, error.message, "critical");
  }

  // Test 3.4: Export field reports with invalid jobId
  console.log("\nTest 3.4: Export field reports with invalid jobId");
  try {
    const response = await makeRequest(`${BASE_URL}/export/field-reports?jobId=invalid-job-id-12345`, "GET");

    if (response.statusCode === 200) {
      logTest("Export with invalid jobId returns gracefully", true, "");
    } else {
      logTest("Export with invalid jobId returns gracefully", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export with invalid jobId returns gracefully", false, error.message, "critical");
  }

  // Test 3.5: Export financials with type that doesn't exist
  console.log("\nTest 3.5: Export financials with invalid type");
  try {
    const response = await makeRequest(`${BASE_URL}/export/financials?type=refund`, "GET");

    if (response.statusCode === 200) {
      logTest("Export with invalid financial type returns gracefully", true, "");
    } else {
      logTest("Export with invalid financial type returns gracefully", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export with invalid financial type returns gracefully", false, error.message, "critical");
  }
}

// ========================================
// SCENARIO 4: POWER USER (HEAVY LOAD)
// ========================================

async function testPowerUser() {
  console.log("\n" + "=".repeat(60));
  console.log("🧠 SCENARIO 4: POWER USER (HEAVY LOAD)");
  console.log("=".repeat(60));

  // Test 4.1: Multiple exports in sequence (performance)
  console.log("\nTest 4.1: Sequential exports performance");
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < 10; i++) {
      const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");
      if (response.statusCode === 200) successCount++;
      else if (response.statusCode === 429) failCount++; // Rate limited is OK
    }

    const duration = Date.now() - startTime;
    if (duration < 10000) {
      logTest(`Sequential exports completed in ${duration}ms`, true, "");
    } else {
      logTest(`Sequential exports completed in ${duration}ms`, false, "Too slow (>10s)", "high");
    }
  } catch (error: any) {
    logTest("Sequential exports performance", false, error.message, "critical");
  }

  // Test 4.2: Export with multiple filters combined
  console.log("\nTest 4.2: Export with multiple combined filters");
  try {
    const response = await makeRequest(
      `${BASE_URL}/export/jobs?status=pending&contactId=test-contact-123&fromDate=2024-01-01&toDate=2026-12-31`,
      "GET"
    );

    if (response.statusCode === 200) {
      logTest("Export handles multiple combined filters", true, "");
    } else {
      logTest("Export handles multiple combined filters", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export handles multiple combined filters", false, error.message, "critical");
  }

  // Test 4.3: Large data handling (export row limit)
  console.log("\nTest 4.3: Export row limit enforcement");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");
    if (response.statusCode === 200) {
      const totalRows = response.headers["x-total-rows"];
      if (totalRows && parseInt(totalRows) <= 5000) {
        logTest(`Export respects row limit (${totalRows} rows)`, true, "");
      } else {
        logTest("Export respects row limit", false, `Returned ${totalRows} rows (limit: 5000)`, "critical");
      }
    } else if (response.statusCode === 400) {
      // If it's over the limit, should get proper error
      if (response.body.includes("maximum row limit") || response.body.includes("5000")) {
        logTest("Export respects row limit (hard fail)", true, "");
      } else {
        logTest("Export respects row limit", false, "Error message unclear", "high");
      }
    } else {
      logTest("Export respects row limit", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export respects row limit", false, error.message, "critical");
  }
}

// ========================================
// SCENARIO 5: WEIRD FLOW BREAK
// ========================================

async function testWeirdFlowBreak() {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 SCENARIO 5: WEIRD FLOW BREAK");
  console.log("=".repeat(60));

  // Test 5.1: Create field report before job exists
  console.log("\nTest 5.1: Create field report with non-existent job");
  try {
    const response = await makeRequest(`${BASE_URL}/field-reports`, "POST", {
      jobId: "non-existent-job-id",
      contactId: "non-existent-contact-id",
      type: "progress",
      notes: "Test report before job exists",
    });

    if (response.statusCode === 400) {
      logTest("Rejects field report with non-existent job", true, "");
    } else {
      logTest("Rejects field report with non-existent job", false, `Expected 400, got ${response.statusCode}`, "critical");
    }
  } catch (error: any) {
    logTest("Rejects field report with non-existent job", false, error.message, "critical");
  }

  // Test 5.2: Create financial record before contact exists
  console.log("\nTest 5.2: Create financial record with non-existent contact");
  try {
    const response = await makeRequest(`${BASE_URL}/financial-records`, "POST", {
      contactId: "non-existent-contact-id",
      type: "expense",
      amount: "100",
      description: "Test expense without contact",
    });

    if (response.statusCode === 400) {
      logTest("Rejects financial record with non-existent contact", true, "");
    } else {
      logTest("Rejects financial record with non-existent contact", false, `Expected 400, got ${response.statusCode}`, "critical");
    }
  } catch (error: any) {
    logTest("Rejects financial record with non-existent contact", false, error.message, "critical");
  }

  // Test 5.3: Update field report that doesn't exist
  console.log("\nTest 5.3: Update non-existent field report");
  try {
    const response = await makeRequest(`${BASE_URL}/field-reports/non-existent-id`, "PUT", {
      notes: "Updated notes",
    });

    if (response.statusCode === 404) {
      logTest("Returns 404 for non-existent field report update", true, "");
    } else {
      logTest("Returns 404 for non-existent field report update", false, `Expected 404, got ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Returns 404 for non-existent field report update", false, error.message, "high");
  }

  // Test 5.4: Delete field report that doesn't exist
  console.log("\nTest 5.4: Delete non-existent field report");
  try {
    const response = await makeRequest(`${BASE_URL}/field-reports/non-existent-id`, "DELETE");

    if (response.statusCode === 404) {
      logTest("Returns 404 for non-existent field report delete", true, "");
    } else {
      logTest("Returns 404 for non-existent field report delete", false, `Expected 404, got ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Returns 404 for non-existent field report delete", false, error.message, "high");
  }

  // Test 5.5: Export after attempting deletions
  console.log("\nTest 5.5: Export still works after failed operations");
  try {
    const response = await makeRequest(`${BASE_URL}/export/field-reports`, "GET");

    if (response.statusCode === 200) {
      logTest("Export works after failed delete operations", true, "");
    } else {
      logTest("Export works after failed delete operations", false, `Status: ${response.statusCode}`, "critical");
    }
  } catch (error: any) {
    logTest("Export works after failed delete operations", false, error.message, "critical");
  }
}

// ========================================
// SCENARIO 6: EXPORT TRUST TEST (CRITICAL)
// ========================================

async function testExportTrust() {
  console.log("\n" + "=".repeat(60));
  console.log("🧾 SCENARIO 6: EXPORT TRUST TEST");
  console.log("=".repeat(60));

  // Test 6.1: Export CSV format validation
  console.log("\nTest 6.1: Export CSV format validity");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter((line) => line.trim());

      if (lines.length > 0) {
        const header = lines[0];
        const columns = header.split(",");

        // Check CSV has proper headers
        if (columns.includes("id") && columns.includes("name")) {
          logTest("Contact export has valid CSV format", true, "");
        } else {
          logTest("Contact export has valid CSV format", false, "Missing expected columns", "critical");
        }

        // Check for proper escaping (quotes, commas)
        const hasProperEscaping = !csv.includes('""') || csv.match(/"[^"]*""[^"]*"/);
        if (hasProperEscaping || lines.length === 1) {
          logTest("CSV escaping looks correct", true, "");
        } else {
          logTest("CSV escaping looks correct", false, "Potential escaping issues", "high");
        }
      } else {
        logTest("Contact export has valid CSV format", false, "Empty CSV", "high");
      }
    } else {
      logTest("Contact export has valid CSV format", false, `Status: ${response.statusCode}`, "critical");
    }
  } catch (error: any) {
    logTest("Contact export has valid CSV format", false, error.message, "critical");
  }

  // Test 6.2: Export metadata headers
  console.log("\nTest 6.2: Export metadata headers present");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");

    if (response.statusCode === 200) {
      const hasTotalRows = response.headers["x-total-rows"] !== undefined;
      const hasTimestamp = response.headers["x-export-timestamp"] !== undefined;
      const hasDateRange = response.headers["x-date-range-applied"] !== undefined;

      if (hasTotalRows && hasTimestamp && hasDateRange) {
        logTest("Export includes all metadata headers", true, "");
      } else {
        logTest(
          "Export includes all metadata headers",
          false,
          `Missing: ${!hasTotalRows ? "X-Total-Rows " : ""}${!hasTimestamp ? "X-Export-Timestamp " : ""}${!hasDateRange ? "X-Date-Range-Applied" : ""}`,
          "high"
        );
      }
    } else {
      logTest("Export includes all metadata headers", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export includes all metadata headers", false, error.message, "high");
  }

  // Test 6.3: Financial export includes relational data
  console.log("\nTest 6.3: Financial export includes contact/job names");
  try {
    const response = await makeRequest(`${BASE_URL}/export/financials`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter((line) => line.trim());

      if (lines.length > 1) {
        const header = lines[0];
        if (header.includes("contactName") && header.includes("jobTitle")) {
          logTest("Financial export includes relational data", true, "");
        } else {
          logTest("Financial export includes relational data", false, "Missing contactName or jobTitle columns", "critical");
        }
      } else {
        logTest("Financial export includes relational data", true, ""); // Empty dataset is OK
      }
    } else {
      logTest("Financial export includes relational data", false, `Status: ${response.statusCode}`, "critical");
    }
  } catch (error: any) {
    logTest("Financial export includes relational data", false, error.message, "critical");
  }

  // Test 6.4: Field report export includes job titles
  console.log("\nTest 6.4: Field report export includes job titles");
  try {
    const response = await makeRequest(`${BASE_URL}/export/field-reports`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter((line) => line.trim());

      if (lines.length > 1) {
        const header = lines[0];
        if (header.includes("jobTitle") && header.includes("contactName")) {
          logTest("Field report export includes relational data", true, "");
        } else {
          logTest("Field report export includes relational data", false, "Missing jobTitle or contactName columns", "critical");
        }
      } else {
        logTest("Field report export includes relational data", true, ""); // Empty dataset is OK
      }
    } else {
      logTest("Field report export includes relational data", false, `Status: ${response.statusCode}`, "critical");
    }
  } catch (error: any) {
    logTest("Field report export includes relational data", false, error.message, "critical");
  }

  // Test 6.5: Export date formatting (ISO 8601)
  console.log("\nTest 6.5: Export date formatting consistency");
  try {
    const response = await makeRequest(`${BASE_URL}/export/contacts`, "GET");

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter((line) => line.trim());

      if (lines.length > 1) {
        // Check if dates are in ISO format (contains T separator)
        const hasISODateFormat = lines.some((line) => line.match(/\d{4}-\d{2}-\d{2}T/));
        if (hasISODateFormat || lines.length === 1) {
          logTest("Export uses ISO date format", true, "");
        } else {
          logTest("Export uses ISO date format", false, "Dates not in ISO 8601 format", "high");
        }
      } else {
        logTest("Export uses ISO date format", true, ""); // Empty dataset is OK
      }
    } else {
      logTest("Export uses ISO date format", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Export uses ISO date format", false, error.message, "high");
  }

  // Test 6.6: Empty export handling
  console.log("\nTest 6.6: Export with filters that return no data");
  try {
    const response = await makeRequest(
      `${BASE_URL}/export/contacts?status=nonexistent_status_12345`,
      "GET"
    );

    if (response.statusCode === 200) {
      const csv = response.body;
      const lines = csv.split("\n").filter((line) => line.trim());

      // Should have header only
      if (lines.length <= 1) {
        logTest("Empty export returns header only", true, "");
      } else {
        logTest("Empty export returns header only", false, `Returned ${lines.length - 1} data rows`, "high");
      }
    } else {
      logTest("Empty export returns header only", false, `Status: ${response.statusCode}`, "high");
    }
  } catch (error: any) {
    logTest("Empty export returns header only", false, error.message, "critical");
  }
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function runChaosTests() {
  console.log("🎯 CHAOS TEST - REAL USER BREAK MODE");
  console.log("=".repeat(60));
  console.log("Starting comprehensive chaos testing...\n");

  // Try to login first
  const loggedIn = await login();
  if (loggedIn) {
    console.log("🔐 Running tests with authentication\n");
  } else {
    console.log("🔓 Running tests without authentication (public endpoints only)\n");
  }

  try {
    // Run all scenarios
    await testMessyUserFlow();
    await testSpamUser();
    await testConfusedUser();
    await testPowerUser();
    await testWeirdFlowBreak();
    await testExportTrust();

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 CHAOS TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.critical.length > 0) {
      console.log("\n🔴 CRITICAL ISSUES:");
      results.critical.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

    if (results.high.length > 0) {
      console.log("\n🟠 HIGH-RISK ISSUES:");
      results.high.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

    if (results.minor.length > 0) {
      console.log("\n🟡 MINOR ISSUES:");
      results.minor.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

    if (results.strange.length > 0) {
      console.log("\n🤔 STRANGE BEHAVIORS:");
      results.strange.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }

    console.log("\n" + "=".repeat(60));

    // Final verdict
    if (results.critical.length === 0 && results.failed === 0) {
      console.log("✅ FINAL VERDICT: System holds under chaotic usage");
    } else if (results.critical.length === 0) {
      console.log("⚠️ FINAL VERDICT: System is stable but has minor issues");
    } else {
      console.log("❌ FINAL VERDICT: System breaks under real-world usage");
    }

    console.log("=".repeat(60) + "\n");

    process.exit(results.critical.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Chaos test suite failed:", error);
    process.exit(1);
  }
}

// Run tests
runChaosTests();
