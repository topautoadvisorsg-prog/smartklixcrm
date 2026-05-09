# CRM + Field Ops + Export System - Testing Guide

## Quick Start

### 1. Start the Server
```bash
npm run dev
```

### 2. Seed Mock Data
```bash
npx ts-node server/seed-utils.ts
```

### 3. Run End-to-End Tests
```bash
npx ts-node server/test-exports.ts
```

## Manual Testing

### Export Endpoints (Direct Browser Access)
- Contacts: http://localhost:5001/api/export/contacts
- Jobs: http://localhost:5001/api/export/jobs
- Financials: http://localhost:5001/api/export/financials
- Field Reports: http://localhost:5001/api/export/field-reports

### Create Test Data via API

```bash
# Create a contact
curl -X POST http://localhost:5001/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+1-555-0001",
    "contactType": "individual",
    "source": "manual"
  }'

# Create a job (use contact ID from previous response)
curl -X POST http://localhost:5001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Job",
    "clientId": "CONTACT_ID_HERE",
    "status": "pending",
    "value": "1000"
  }'

# Create a field report (use job and contact IDs)
curl -X POST http://localhost:5001/api/field-reports \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "JOB_ID_HERE",
    "contactId": "CONTACT_ID_HERE",
    "type": "progress",
    "notes": "Work in progress",
    "statusUpdate": "50% complete"
  }'

# Create a financial record
curl -X POST http://localhost:5001/api/financial-records \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "JOB_ID_HERE",
    "contactId": "CONTACT_ID_HERE",
    "type": "expense",
    "category": "materials",
    "amount": "150.00",
    "description": "Purchased supplies"
  }'
```

## What's Tested

✅ Empty database handling (no crashes)
✅ Mock data generation (contacts, jobs, reports, financials)
✅ All 4 export endpoints return valid CSV
✅ CSV includes relational data (names, not just IDs)
✅ Data integrity (no orphaned records)
✅ Validation prevents invalid references
✅ Null/undefined field handling
✅ Date formatting (ISO 8601)
✅ Array serialization (photos, etc.)

## Expected Results

All exports should:
- Return HTTP 200
- Include CSV headers
- Contain relational data (contact names, job titles)
- Handle empty fields gracefully
- Use consistent ISO date format
- Never crash on partial data
