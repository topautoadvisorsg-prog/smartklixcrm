# CRM Core Data Model + Export Center - Integration Instructions

## Phase 3: API Routes Integration

A new routes file has been created with all the necessary endpoints:
- **File:** `server/routes-field-financial-export.ts`

### To integrate into the main application:

Add these lines to `server/index.ts` after line 123 (after `const server = await registerRoutes(app);`):

```typescript
// Import and mount field reports, financial records, and export routes
import fieldFinancialExportRoutes from "./routes-field-financial-export";
app.use("/api", fieldFinancialExportRoutes);
```

**OR** if you prefer to add it inside the `registerRoutes` function in `server/routes.ts`, add at the end of the function (before returning the server):

```typescript
// Add near the top of routes.ts with other imports
import fieldFinancialExportRoutes from "./routes-field-financial-export";

// Add near the end of registerRoutes function, before returning server
app.use("/api", fieldFinancialExportRoutes);
```

---

## Available API Endpoints

### Field Reports
- `GET /api/field-reports?jobId=&contactId=&type=` - List field reports with filters
- `GET /api/field-reports/:id` - Get single report
- `POST /api/field-reports` - Create new report
- `PUT /api/field-reports/:id` - Update report
- `DELETE /api/field-reports/:id` - Delete report

### Financial Records
- `GET /api/financial-records?contactId=&jobId=&type=&fromDate=&toDate=` - List records with filters
- `GET /api/financial-records/:id` - Get single record
- `POST /api/financial-records` - Create new record
- `PUT /api/financial-records/:id` - Update record
- `DELETE /api/financial-records/:id` - Delete record
- `GET /api/financial-records/summary?contactId=` - Get income/expense summary

### Export Center (CSV Downloads)
- `GET /api/export/contacts?status=&source=&contactType=&fromDate=&toDate=` - Export contacts
- `GET /api/export/jobs?status=&contactId=&fromDate=&toDate=` - Export jobs
- `GET /api/export/financials?contactId=&jobId=&type=&fromDate=&toDate=` - Export financial records
- `GET /api/export/field-reports?contactId=&jobId=&type=&fromDate=&toDate=` - Export field reports

All export endpoints return CSV files with `Content-Disposition: attachment` header for automatic download.

---

## Next Steps

After integrating the routes, proceed with:
- Phase 4: Create Export Center UI page
- Phase 5: Add Field Reports UI to Jobs page
- Phase 6: Add Financial Records UI to Jobs page
- Phase 7: Update navigation and routing
