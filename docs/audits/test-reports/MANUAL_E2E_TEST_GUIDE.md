# 🔍 MANUAL E2E RUNTIME TEST GUIDE

**IMPORTANT:** You need to run these tests manually in your browser because the server uses in-memory storage.

---

## 🚀 STEP 0: RESTART SERVER WITH ADMIN USER

The server needs an admin user. Do ONE of these:

### Option A: Add to server startup (RECOMMENDED)

Edit `server/index.ts` and add this BEFORE the server starts listening (around line 145):

```typescript
// Create default admin user if not exists
import bcrypt from "bcryptjs";

(async () => {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
      email: "admin@smartklix.com",
      role: "admin",
    });
    console.log("✅ Admin user created: admin / admin123");
  }
})();
```

Then restart: `npm run dev`

### Option B: Use existing user

If you already have a user account, use those credentials instead.

---

## 🧪 STEP 1: LOGIN TEST

**URL:** `http://localhost:5000` (or your dev URL)

**Actions:**
1. Open browser
2. Navigate to app
3. Should see login screen
4. Enter: `admin` / `admin123`
5. Click Login

**Expected:**
- ✅ Login succeeds
- ✅ Redirected to dashboard
- ✅ No errors in console
- ✅ Session persists on refresh

**❌ If it fails:**
- Check browser console for errors
- Check server terminal for errors
- Verify user was created

---

## 📝 STEP 2: CREATE FLOW (Contact → Job → Report → Financial)

### 2.1: Create Contact

**Actions:**
1. Navigate to Contacts page
2. Click "Create Contact" or "+" button
3. Fill in:
   - Name: `E2E Test Contact`
   - Email: `e2e@test.com`
   - Phone: `+1-555-0001`
   - Company: `Test Company`
   - Status: `New`
4. Click Save/Create

**Expected:**
- ✅ Contact created successfully
- ✅ Success toast/notification appears
- ✅ Contact appears in list
- ✅ Can click to view details

**Data to note:**
- Contact ID (from URL or details page)

---

### 2.2: Create Job

**Actions:**
1. Navigate to Jobs page
2. Click "Create Job"
3. Fill in:
   - Title: `E2E Test Job`
   - Client: Select "E2E Test Contact"
   - Status: `Pending`
   - Value: `1500`
   - Description: `Test job for E2E validation`
4. Click Save/Create

**Expected:**
- ✅ Job created successfully
- ✅ Shows correct client name
- ✅ Appears in job list
- ✅ Can click to view details

**Data to note:**
- Job ID

---

### 2.3: Add Field Report

**Actions:**
1. Open the job you just created
2. Navigate to "Field Reports" tab
3. Click "Add Report"
4. Fill in:
   - Type: `Progress`
   - Notes: `E2E test field report - work in progress`
   - Status Update: `50% complete`
5. Click Create

**Expected:**
- ✅ Report created successfully
- ✅ Appears in field reports list
- ✅ Shows correct type badge
- ✅ Notes display properly

---

### 2.4: Add Financial Record

**Actions:**
1. In the same job, navigate to "Financials" tab
2. Click "Add Record"
3. Fill in:
   - Type: `Expense`
   - Category: `materials`
   - Amount: `250.00`
   - Description: `E2E test expense`
   - Date: Today
4. Click Create

**Expected:**
- ✅ Financial record created
- ✅ Shows in financial list
- ✅ Updates financial summary
- ✅ Net profit calculates correctly

---

## 💥 STEP 3: BREAK IT ON PURPOSE

### 3.1: Invalid Job ID

**Test:**
1. Try to create a field report via API (use Postman/Thunder Client):

```http
POST http://localhost:5000/api/field-reports
Content-Type: application/json
Cookie: [your session cookie]

{
  "jobId": "nonexistent-id",
  "contactId": "nonexistent-id",
  "type": "progress",
  "notes": "This should fail"
}
```

**Expected:**
- ✅ Returns 400 error
- ✅ Clear error message: "Job does not exist"
- ✅ No crash

---

### 3.2: Large Input (Just Under Limit)

**Test:**
```http
POST http://localhost:5000/api/field-reports
Content-Type: application/json

{
  "jobId": "[valid job id]",
  "contactId": "[valid contact id]",
  "type": "progress",
  "notes": "AAAAA... (4999 A's)"
}
```

**Expected:**
- ✅ Accepted (under 5000 limit)
- ✅ Saves successfully

---

### 3.3: Massive Input (Over Limit)

**Test:**
```http
POST http://localhost:5000/api/field-reports
Content-Type: application/json

{
  "jobId": "[valid job id]",
  "contactId": "[valid contact id]",
  "type": "progress",
  "notes": "AAAAA... (5001 A's)"
}
```

**Expected:**
- ✅ Returns 400 error
- ✅ Error: "Notes must be less than 5000 characters"
- ✅ No crash

---

### 3.4: Wrong Relationship

**Test:**
```http
POST http://localhost:5000/api/financial-records
Content-Type: application/json

{
  "jobId": "[job A id]",
  "contactId": "[contact B id - NOT the job's client]",
  "type": "expense",
  "amount": "100",
  "description": "Mismatched relationship"
}
```

**Expected:**
- ✅ Returns 400 error
- ✅ Error: "Job does not belong to contact"
- ✅ No crash

---

### 3.5: Negative Amount

**Test:**
```http
POST http://localhost:5000/api/financial-records
Content-Type: application/json

{
  "contactId": "[valid contact]",
  "type": "expense",
  "amount": "-100",
  "description": "Negative amount"
}
```

**Expected:**
- ✅ Returns 400 error
- ✅ Error: "Amount must be greater than 0"

---

## 📤 STEP 4: EXPORT TEST (REAL CSV)

### 4.1: Export Contacts

**Via UI:**
1. Navigate to Export Center (or Contacts page)
2. Click "Export Contacts"
3. CSV should download

**Check the file:**
- ✅ Opens in Excel without errors
- ✅ Contains "E2E Test Contact"
- ✅ Headers are correct (id, name, email, etc.)
- ✅ No JSON errors
- ✅ No weird characters

**Via Browser:**
```
http://localhost:5000/api/export/contacts
```

---

### 4.2: Export Jobs

**Expected:**
- ✅ Contains "E2E Test Job"
- ✅ Shows client name (not just ID)
- ✅ CSV format is clean

---

### 4.3: Export Financials

**Expected:**
- ✅ Contains test financial record
- ✅ Shows contact name
- ✅ Shows job title
- ✅ Amount is correct ($250.00)

---

### 4.4: Export Field Reports

**Expected:**
- ✅ Contains test field report
- ✅ Shows job title
- ✅ Shows contact name
- ✅ Notes display correctly

---

## 💾 STEP 5: DATA PERSISTENCE

### 5.1: Refresh Page

**Actions:**
1. After creating all data, refresh browser
2. Navigate to Contacts
3. Navigate to Jobs
4. Open the test job

**Expected:**
- ✅ E2E Test Contact still exists
- ✅ E2E Test Job still exists
- ✅ Field report still there
- ✅ Financial record still there
- ✅ All data persisted

---

### 5.2: Check API Directly

**Test:**
```http
GET http://localhost:5000/api/contacts
```

**Expected:**
- ✅ Returns array with E2E Test Contact
- ✅ All fields correct

**Test:**
```http
GET http://localhost:5000/api/jobs
```

**Expected:**
- ✅ Returns array with E2E Test Job
- ✅ clientId matches contact

---

## 📊 TEST RESULTS CHECKLIST

Print this and check off as you go:

```
LOGIN:
[ ] Login with admin/admin123 succeeds
[ ] Redirects to dashboard
[ ] Session persists

CREATE FLOW:
[ ] Contact created successfully
[ ] Job created with correct client
[ ] Field report created
[ ] Financial record created
[ ] Financial summary updates

BREAK TESTS:
[ ] Invalid jobId rejected (400)
[ ] Large input (4999 chars) accepted
[ ] Oversize input (5001 chars) rejected (400)
[ ] Mismatched relationship rejected (400)
[ ] Negative amount rejected (400)

EXPORT TESTS:
[ ] Contacts export downloads
[ ] CSV opens in Excel cleanly
[ ] Contains test data
[ ] Jobs export includes client names
[ ] Financials export includes relational data
[ ] Field reports export includes job titles

PERSISTENCE:
[ ] Data survives page refresh
[ ] API returns created data
[ ] No missing records

UI BEHAVIOR:
[ ] No console errors
[ ] Toast notifications work
[ ] Forms clear after submit
[ ] Loading states show
[ ] Error messages are clear
```

---

## 🎯 SUCCESS CRITERIA

**System passes if:**
- ✅ All create operations succeed
- ✅ All validation errors are clean (no crashes)
- ✅ All exports produce valid CSVs
- ✅ Data persists correctly
- ✅ No silent failures
- ✅ UI handles all states properly

**System fails if:**
- ❌ Any operation crashes
- ❌ Data doesn't persist
- ❌ Exports produce invalid CSV
- ❌ Validation errors are unclear
- ❌ Silent failures occur

---

## 🚨 REPORT ANY ISSUES

If you find bugs, note:
1. What you did (exact steps)
2. What you expected
3. What actually happened
4. Screenshot if UI issue
5. Console errors if any
6. Server terminal errors if any

---

**Good luck! This is the REAL test.** 🚀
