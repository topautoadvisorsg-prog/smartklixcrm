/**
 * Seed Utilities for CRM + Field Ops + Export System Testing
 * 
 * Provides functions to create mock data for end-to-end testing:
 * - seedContacts() - Create test contacts
 * - seedJobs() - Create test jobs linked to contacts
 * - seedFieldReports() - Create field reports linked to jobs + contacts
 * - seedFinancialRecords() - Create financial records linked to jobs + contacts
 * - seedAll() - Create complete test dataset
 * 
 * Usage:
 *   import { seedAll, seedContacts } from './seed-utils';
 *   await seedContacts(5); // Create 5 contacts
 *   await seedAll(); // Create complete dataset
 */

import { storage } from "./storage";
import { randomUUID } from "crypto";

// ========================================
// CONTACT SEEDING
// ========================================

export async function seedContacts(count: number = 5) {
  const contacts = [];
  const contactTypes = ['individual', 'business'] as const;
  const sources = ['manual', 'crawler', 'referral', 'intake'] as const;
  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;

  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const companies = ['Acme Corp', 'TechStart Inc', 'Global Services', 'Local Business', 'Enterprise Solutions', 'Small Shop LLC'];

  for (let i = 0; i < count; i++) {
    const contactType = contactTypes[Math.floor(Math.random() * contactTypes.length)];
    const isBusiness = contactType === 'business';
    
    const contact = await storage.createContact({
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      email: `test${i}@example.com`,
      phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
      company: isBusiness ? companies[i % companies.length] : undefined,
      contactType,
      source: sources[i % sources.length],
      status: statuses[i % statuses.length],
      tags: ['test', 'seeded'],
    });

    contacts.push(contact);
    console.log(`✓ Created contact: ${contact.name} (${contact.id})`);
  }

  return contacts;
}

// ========================================
// JOB SEEDING
// ========================================

export async function seedJobs(contactIds: string[], count: number = 3) {
  const jobs = [];
  const statuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const;
  const jobTitles = [
    'Website Redesign',
    'Mobile App Development',
    'CRM Integration',
    'Data Migration',
    'Security Audit',
    'Performance Optimization',
    'API Development',
    'Database Upgrade',
  ];

  for (let i = 0; i < count; i++) {
    const clientId = contactIds[i % contactIds.length];
    const title = jobTitles[i % jobTitles.length];
    
    const scheduledStart = new Date();
    scheduledStart.setDate(scheduledStart.getDate() + i * 7);
    
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setDate(scheduledEnd.getDate() + 14);

    const job = await storage.createJob({
      title,
      clientId,
      status: statuses[i % statuses.length],
      estimatedValue: String(1000 + i * 500),
      scope: `Test job ${i + 1} - ${title}`,
      scheduledStart,
      scheduledEnd,
    });

    jobs.push(job);
    console.log(`✓ Created job: ${job.title} (${job.id}) for contact ${clientId}`);
  }

  return jobs;
}

// ========================================
// FIELD REPORT SEEDING
// ========================================

export async function seedFieldReports(jobs: any[], contacts: any[], count: number = 5) {
  const reports = [];
  const types = ['progress', 'issue', 'completion', 'inspection'] as const;

  for (let i = 0; i < count; i++) {
    const job = jobs[i % jobs.length];
    const contact = contacts[i % contacts.length];

    const report = await storage.createFieldReport({
      jobId: job.id,
      contactId: contact.id,
      type: types[i % types.length],
      observations: `Field report observations for ${job.title} - Test report ${i + 1}`,
      photos: i % 2 === 0 ? [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
      ] : [],
      statusUpdate: `Status update: ${types[i % types.length]} - ${i * 20}% complete`,
    });

    reports.push(report);
    console.log(`✓ Created field report: ${report.type} for job ${job.title} (${report.id})`);
  }

  return reports;
}

// ========================================
// FINANCIAL RECORD SEEDING
// ========================================

export async function seedFinancialRecords(jobs: any[], contacts: any[], count: number = 6) {
  const records = [];
  const types = ['income', 'expense'] as const;
  const categories = ['materials', 'labor', 'travel', 'equipment', 'payment', 'consulting'];

  for (let i = 0; i < count; i++) {
    const job = jobs[i % jobs.length];
    const contact = contacts[i % contacts.length];
    const type = types[i % types.length];
    const isExpense = type === 'expense';

    const date = new Date();
    date.setDate(date.getDate() - i * 3);

    const record = await storage.createFinancialRecord({
      jobId: job.id,
      contactId: contact.id,
      type,
      category: categories[i % categories.length],
      amount: String(isExpense ? 100 + i * 50 : 500 + i * 200),
      description: `${isExpense ? 'Expense' : 'Income'}: ${categories[i % categories.length]} for ${job.title}`,
      date,
    });

    records.push(record);
    console.log(`✓ Created financial record: ${type} $${record.amount} for job ${job.title} (${record.id})`);
  }

  return records;
}

// ========================================
// COMPLETE DATASET SEEDING
// ========================================

export async function seedAll(options?: {
  contacts?: number;
  jobs?: number;
  fieldReports?: number;
  financialRecords?: number;
}) {
  const {
    contacts: contactCount = 5,
    jobs: jobCount = 3,
    fieldReports: reportCount = 5,
    financialRecords: financialCount = 6,
  } = options || {};

  console.log('\n🌱 Starting seed process...\n');

  // Step 1: Create contacts
  console.log('📇 Creating contacts...');
  const contacts = await seedContacts(contactCount);
  const contactIds = contacts.map(c => c.id);

  // Step 2: Create jobs linked to contacts
  console.log('\n💼 Creating jobs...');
  const jobs = await seedJobs(contactIds, jobCount);

  // Step 3: Create field reports linked to jobs + contacts
  console.log('\n📋 Creating field reports...');
  const fieldReports = await seedFieldReports(jobs, contacts, reportCount);

  // Step 4: Create financial records linked to jobs + contacts
  console.log('\n💰 Creating financial records...');
  const financialRecords = await seedFinancialRecords(jobs, contacts, financialCount);

  console.log('\n✅ Seed process complete!\n');
  console.log(`📊 Summary:`);
  console.log(`   Contacts: ${contacts.length}`);
  console.log(`   Jobs: ${jobs.length}`);
  console.log(`   Field Reports: ${fieldReports.length}`);
  console.log(`   Financial Records: ${financialRecords.length}`);
  console.log(`\n🔗 All data is properly linked and ready for export testing.\n`);

  return {
    contacts,
    jobs,
    fieldReports,
    financialRecords,
  };
}

// ========================================
// CLI USAGE
// ========================================

// Check if this file is being run directly (not imported)
const isMainModule = process.argv[1] && process.argv[1].includes('seed-utils');

if (isMainModule) {
  (async () => {
    try {
      await seedAll();
      process.exit(0);
    } catch (error) {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    }
  })();
}
