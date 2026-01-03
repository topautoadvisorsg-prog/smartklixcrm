import { 
  type User, 
  type InsertUser,
  type Contact,
  type InsertContact,
  type Job,
  type InsertJob,
  type Appointment,
  type InsertAppointment,
  type Note,
  type InsertNote,
  type FileRecord,
  type InsertFileRecord,
  type AuditLogEntry,
  type InsertAuditLogEntry,
  type Estimate,
  type InsertEstimate,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
  type PaymentSlip,
  type InsertPaymentSlip,
  type AiReflection,
  type InsertAiReflection,
  type AiTask,
  type InsertAiTask,
  type AssistQueueEntry,
  type InsertAssistQueueEntry,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type MemoryEntry,
  type InsertMemoryEntry,
  type Settings,
  type InsertSettings,
  type AiSettings,
  type InsertAiSettings,
  type MasterArchitectConfig,
  type InsertMasterArchitectConfig,
  type WebhookEvent,
  type InsertWebhookEvent,
  type AiVoiceDispatchConfig,
  type InsertAiVoiceDispatchConfig,
  type CompanyInstructions,
  type InsertCompanyInstructions,
  type EmailAccount,
  type InsertEmailAccount,
  type Email,
  type InsertEmail,
  type Intake,
  type InsertIntake,
  type IntakeField,
  type InsertIntakeField,
  type IntakeSubmission,
  type InsertIntakeSubmission,
  type Location,
  type InsertLocation,
  type Equipment,
  type InsertEquipment,
  type PricebookItem,
  type InsertPricebookItem,
  type Tag,
  type InsertTag,
  type StoredPaymentMethod,
  type InsertStoredPaymentMethod,
  type EventsOutbox,
  type InsertEventsOutbox,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type AutomationLedger,
  type InsertAutomationLedger,
  type VoiceDispatchLog,
  type InsertVoiceDispatchLog,
  type WorkspaceFile,
  type InsertWorkspaceFile,
  users,
  contacts,
  jobs,
  appointments,
  notes,
  files,
  auditLog,
  estimates,
  invoices,
  payments,
  aiReflection,
  aiTasks,
  assistQueue,
  conversations,
  messages,
  memoryEntries,
  settings,
  aiSettings,
  masterArchitectConfig,
  webhookEvents,
  aiVoiceDispatchConfig,
  companyInstructions,
  emailAccounts,
  emails,
  intakes,
  intakeFields,
  intakeSubmissions,
  locations,
  equipment,
  pricebookItems,
  tags,
  storedPaymentMethods,
  eventsOutbox,
  whatsappMessages,
  automationLedger,
  voiceDispatchLogs,
  paymentSlips,
  workspaceFiles,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db, isDatabaseConnected } from "./db";
import { eq, like, or, and, sql, desc } from "drizzle-orm";

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string): Promise<Contact | undefined>;
  getContactByEmail(email: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  
  getAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  
  getNotes(): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<boolean>;
  
  getFiles(): Promise<FileRecord[]>;
  createFile(file: InsertFileRecord): Promise<FileRecord>;
  
  // Workspace Files (Google Workspace Artifact Mirror)
  getWorkspaceFiles(filters?: { jobId?: string; contactId?: string; type?: string }): Promise<WorkspaceFile[]>;
  getWorkspaceFile(id: string): Promise<WorkspaceFile | undefined>;
  getWorkspaceFileByGoogleId(googleFileId: string): Promise<WorkspaceFile | undefined>;
  createWorkspaceFile(file: InsertWorkspaceFile): Promise<WorkspaceFile>;
  updateWorkspaceFile(id: string, file: Partial<InsertWorkspaceFile>): Promise<WorkspaceFile | undefined>;
  deleteWorkspaceFile(id: string): Promise<boolean>;
  
  getAuditLog(): Promise<AuditLogEntry[]>;
  createAuditLogEntry(entry: InsertAuditLogEntry): Promise<AuditLogEntry>;
  
  getEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  createEstimate(estimate: InsertEstimate): Promise<Estimate>;
  updateEstimate(id: string, estimate: Partial<InsertEstimate>): Promise<Estimate | undefined>;
  deleteEstimate(id: string): Promise<boolean>;
  
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  getPayments(): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  getPaymentSlips(): Promise<PaymentSlip[]>;
  getPaymentSlip(id: string): Promise<PaymentSlip | undefined>;
  createPaymentSlip(slip: InsertPaymentSlip): Promise<PaymentSlip>;
  updatePaymentSlip(id: string, slip: Partial<InsertPaymentSlip>): Promise<PaymentSlip | undefined>;
  
  getAiReflections(): Promise<AiReflection[]>;
  getAiReflection(id: string): Promise<AiReflection | undefined>;
  createAiReflection(reflection: InsertAiReflection): Promise<AiReflection>;
  
  getAiTasks(): Promise<AiTask[]>;
  getAiTask(id: string): Promise<AiTask | undefined>;
  createAiTask(task: InsertAiTask): Promise<AiTask>;
  updateAiTask(id: string, task: Partial<InsertAiTask>): Promise<AiTask | undefined>;
  
  getAssistQueue(): Promise<AssistQueueEntry[]>;
  getAssistQueueEntry(id: string): Promise<AssistQueueEntry | undefined>;
  createAssistQueueEntry(entry: InsertAssistQueueEntry): Promise<AssistQueueEntry>;
  updateAssistQueueEntry(id: string, entry: Partial<InsertAssistQueueEntry>): Promise<AssistQueueEntry | undefined>;

  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByContact(contactId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation | undefined>;

  getMessages(conversationId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;

  getMemoryEntries(conversationId?: string, contactId?: string): Promise<MemoryEntry[]>;
  createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>;
  searchMemory(query: string, contactId?: string): Promise<MemoryEntry[]>;
  searchMemorySimilarity(
    queryEmbedding: number[],
    contactId?: string,
    conversationId?: string,
    limit?: number
  ): Promise<Array<{ entry: MemoryEntry; similarity: number }>>;
  
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;

  getAiSettings(): Promise<AiSettings | undefined>;
  updateAiSettings(config: Partial<InsertAiSettings>): Promise<AiSettings>;

  getMasterArchitectConfig(): Promise<MasterArchitectConfig | undefined>;
  updateMasterArchitectConfig(config: Partial<InsertMasterArchitectConfig>): Promise<MasterArchitectConfig>;

  getWebhookEvents(limit?: number): Promise<WebhookEvent[]>;
  createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;

  getAiVoiceDispatchConfig(): Promise<AiVoiceDispatchConfig | undefined>;
  updateAiVoiceDispatchConfig(config: Partial<InsertAiVoiceDispatchConfig>): Promise<AiVoiceDispatchConfig>;

  getCompanyInstructions(): Promise<CompanyInstructions[]>;
  getCompanyInstructionsById(id: string): Promise<CompanyInstructions | undefined>;
  getCompanyInstructionsByName(name: string): Promise<CompanyInstructions | undefined>;
  createCompanyInstructions(instructions: InsertCompanyInstructions): Promise<CompanyInstructions>;
  updateCompanyInstructions(id: string, instructions: Partial<InsertCompanyInstructions>): Promise<CompanyInstructions | undefined>;
  deleteCompanyInstructions(id: string): Promise<boolean>;

  // Email Accounts
  getEmailAccounts(): Promise<EmailAccount[]>;
  getEmailAccount(id: string): Promise<EmailAccount | undefined>;
  getEmailAccountByAddress(emailAddress: string): Promise<EmailAccount | undefined>;
  createEmailAccount(account: InsertEmailAccount): Promise<EmailAccount>;
  updateEmailAccount(id: string, account: Partial<InsertEmailAccount>): Promise<EmailAccount | undefined>;
  deleteEmailAccount(id: string): Promise<boolean>;

  // Emails
  getEmails(filters?: { accountId?: string; direction?: string; status?: string; limit?: number }): Promise<Email[]>;
  getEmail(id: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, email: Partial<InsertEmail>): Promise<Email | undefined>;
  deleteEmail(id: string): Promise<boolean>;

  // WhatsApp Messages
  getWhatsappMessages(filters?: { contactId?: string; direction?: string; status?: string; limit?: number }): Promise<WhatsappMessage[]>;
  getWhatsappMessage(id: string): Promise<WhatsappMessage | undefined>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessage(id: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage | undefined>;
  deleteWhatsappMessage(id: string): Promise<boolean>;

  // Intakes
  getIntakes(): Promise<Intake[]>;
  getIntake(id: string): Promise<Intake | undefined>;
  getIntakeByWebhookToken(token: string): Promise<Intake | undefined>;
  createIntake(intake: InsertIntake): Promise<Intake>;
  updateIntake(id: string, intake: Partial<InsertIntake>): Promise<Intake | undefined>;
  deleteIntake(id: string): Promise<boolean>;

  // Intake Fields
  getIntakeFields(intakeId: string): Promise<IntakeField[]>;
  getIntakeField(id: string): Promise<IntakeField | undefined>;
  createIntakeField(field: InsertIntakeField): Promise<IntakeField>;
  updateIntakeField(id: string, field: Partial<InsertIntakeField>): Promise<IntakeField | undefined>;
  deleteIntakeField(id: string): Promise<boolean>;

  // Intake Submissions
  getIntakeSubmissions(intakeId?: string): Promise<IntakeSubmission[]>;
  getIntakeSubmission(id: string): Promise<IntakeSubmission | undefined>;
  createIntakeSubmission(submission: InsertIntakeSubmission): Promise<IntakeSubmission>;
  updateIntakeSubmission(id: string, submission: Partial<InsertIntakeSubmission>): Promise<IntakeSubmission | undefined>;

  // Locations
  getLocations(contactId?: string): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;

  // Equipment
  getEquipment(locationId?: string): Promise<Equipment[]>;
  getEquipmentItem(id: string): Promise<Equipment | undefined>;
  createEquipment(equip: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equip: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string): Promise<boolean>;

  // Pricebook
  getPricebookItems(filters?: { category?: string; tier?: string; active?: boolean }): Promise<PricebookItem[]>;
  getPricebookItem(id: string): Promise<PricebookItem | undefined>;
  createPricebookItem(item: InsertPricebookItem): Promise<PricebookItem>;
  updatePricebookItem(id: string, item: Partial<InsertPricebookItem>): Promise<PricebookItem | undefined>;
  deletePricebookItem(id: string): Promise<boolean>;

  // Tags
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;

  // Stored Payment Methods
  getStoredPaymentMethods(contactId: string): Promise<StoredPaymentMethod[]>;
  getStoredPaymentMethod(id: string): Promise<StoredPaymentMethod | undefined>;
  createStoredPaymentMethod(pm: InsertStoredPaymentMethod): Promise<StoredPaymentMethod>;
  deleteStoredPaymentMethod(id: string): Promise<boolean>;

  // Duplicate Detection
  findDuplicateContacts(name?: string, email?: string, phone?: string): Promise<Contact[]>;

  // Events Outbox
  getEventsOutbox(): Promise<EventsOutbox[]>;
  getEventsOutboxByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<EventsOutbox | undefined>;
  createEventsOutbox(entry: InsertEventsOutbox): Promise<EventsOutbox>;
  updateEventsOutboxStatus(id: string, status: string, errorMessage?: string): Promise<EventsOutbox | undefined>;
  getPendingEventsOutbox(limit?: number): Promise<EventsOutbox[]>;
  updateEventsOutboxForRetry(id: string, retryCount: number, status: string, dispatchedAt?: Date, errorMessage?: string): Promise<EventsOutbox | undefined>;

  // Automation Ledger
  getAutomationLedgerEntries(filters?: { agentName?: string; actionType?: string; mode?: string; status?: string; limit?: number }): Promise<AutomationLedger[]>;
  getAutomationLedgerEntry(id: string): Promise<AutomationLedger | undefined>;
  getAutomationLedgerByIdempotencyKey(idempotencyKey: string): Promise<AutomationLedger | undefined>;
  createAutomationLedgerEntry(entry: InsertAutomationLedger): Promise<AutomationLedger>;
  updateAutomationLedgerEntry(id: string, updates: Partial<InsertAutomationLedger>): Promise<AutomationLedger | undefined>;

  // Voice Dispatch Logs
  getVoiceDispatchLogs(): Promise<VoiceDispatchLog[]>;
  getVoiceDispatchLog(id: string): Promise<VoiceDispatchLog | undefined>;
  createVoiceDispatchLog(log: InsertVoiceDispatchLog): Promise<VoiceDispatchLog>;
  updateVoiceDispatchLog(id: string, updates: Partial<InsertVoiceDispatchLog>): Promise<VoiceDispatchLog | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contacts: Map<string, Contact>;
  private jobs: Map<string, Job>;
  private appointments: Map<string, Appointment>;
  private notes: Map<string, Note>;
  private files: Map<string, FileRecord>;
  private auditLogs: AuditLogEntry[];
  private estimates: Map<string, Estimate>;
  private invoices: Map<string, Invoice>;
  private payments: Map<string, Payment>;
  private paymentSlipsMap: Map<string, PaymentSlip>;
  private aiReflections: Map<string, AiReflection>;
  private aiTasksMap: Map<string, AiTask>;
  private assistQueueMap: Map<string, AssistQueueEntry>;
  private conversationsMap: Map<string, Conversation>;
  private messagesMap: Map<string, Message>;
  private memoryEntriesMap: Map<string, MemoryEntry>;
  private settingsData: Settings | undefined;
  private masterArchitectConfigData: MasterArchitectConfig | undefined;
  private aiVoiceDispatchConfigData: AiVoiceDispatchConfig | undefined;
  private webhookEventsArray: WebhookEvent[];
  private companyInstructionsMap: Map<string, CompanyInstructions>;
  private emailAccountsMap: Map<string, EmailAccount>;
  private emailsMap: Map<string, Email>;
  private intakesMap: Map<string, Intake>;
  private intakeFieldsMap: Map<string, IntakeField>;
  private intakeSubmissionsMap: Map<string, IntakeSubmission>;
  private eventsOutboxMap: Map<string, EventsOutbox>;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.jobs = new Map();
    this.appointments = new Map();
    this.notes = new Map();
    this.files = new Map();
    this.auditLogs = [];
    this.estimates = new Map();
    this.invoices = new Map();
    this.payments = new Map();
    this.paymentSlipsMap = new Map();
    this.aiReflections = new Map();
    this.aiTasksMap = new Map();
    this.assistQueueMap = new Map();
    this.conversationsMap = new Map();
    this.messagesMap = new Map();
    this.memoryEntriesMap = new Map();
    this.settingsData = undefined;
    this.masterArchitectConfigData = undefined;
    this.aiVoiceDispatchConfigData = undefined;
    this.webhookEventsArray = [];
    this.companyInstructionsMap = new Map();
    this.emailAccountsMap = new Map();
    this.emailsMap = new Map();
    this.intakesMap = new Map();
    this.intakeFieldsMap = new Map();
    this.intakeSubmissionsMap = new Map();
    this.eventsOutboxMap = new Map();
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || `${insertUser.username}@example.com`,
      role: insertUser.role || "user",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values());
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find(c => c.phone === phone);
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find(c => c.email === email);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = {
      id,
      name: insertContact.name ?? null,
      email: insertContact.email ?? null,
      phone: insertContact.phone ?? null,
      company: insertContact.company ?? null,
      status: insertContact.status ?? "new",
      avatar: insertContact.avatar ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, update: Partial<InsertContact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    const updated = { ...contact, ...update, updatedAt: new Date() };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contacts.delete(id);
  }

  async getJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      id,
      title: insertJob.title,
      clientId: insertJob.clientId ?? null,
      status: insertJob.status ?? "lead_intake",
      value: insertJob.value ?? null,
      deadline: insertJob.deadline ?? null,
      description: insertJob.description ?? null,
      jobType: insertJob.jobType ?? "lead",
      jobNumber: insertJob.jobNumber ?? null,
      scheduledStart: insertJob.scheduledStart ?? null,
      scheduledEnd: insertJob.scheduledEnd ?? null,
      closedAt: insertJob.closedAt ?? null,
      assignedTechs: insertJob.assignedTechs ?? [],
      sourceLeadId: insertJob.sourceLeadId ?? null,
      sourceEstimateId: insertJob.sourceEstimateId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, update: Partial<InsertJob>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    const updated = { ...job, ...update, updatedAt: new Date() };
    this.jobs.set(id, updated);
    return updated;
  }

  async getAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
    const appointment: Appointment = {
      id,
      title: insertAppointment.title,
      contactId: insertAppointment.contactId ?? null,
      scheduledAt: insertAppointment.scheduledAt,
      duration: insertAppointment.duration ?? 60,
      status: insertAppointment.status ?? "pending",
      notes: insertAppointment.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: string, update: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    const updated = { ...appointment, ...update, updatedAt: new Date() };
    this.appointments.set(id, updated);
    return updated;
  }

  async getNotes(): Promise<Note[]> {
    return Array.from(this.notes.values());
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = randomUUID();
    const note: Note = {
      id,
      title: insertNote.title,
      content: insertNote.content,
      entityType: insertNote.entityType ?? null,
      entityId: insertNote.entityId ?? null,
      tags: insertNote.tags ?? null,
      pinned: insertNote.pinned ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notes.set(id, note);
    return note;
  }

  async updateNote(id: string, update: Partial<InsertNote>): Promise<Note | undefined> {
    const note = this.notes.get(id);
    if (!note) return undefined;
    const updated = { ...note, ...update, updatedAt: new Date() };
    this.notes.set(id, updated);
    return updated;
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }

  async getFiles(): Promise<FileRecord[]> {
    return Array.from(this.files.values());
  }

  async createFile(insertFile: InsertFileRecord): Promise<FileRecord> {
    const id = randomUUID();
    const file: FileRecord = {
      id,
      name: insertFile.name,
      type: insertFile.type,
      size: insertFile.size,
      url: insertFile.url ?? null,
      uploadedBy: insertFile.uploadedBy ?? null,
      entityType: insertFile.entityType ?? null,
      entityId: insertFile.entityId ?? null,
      createdAt: new Date(),
    };
    this.files.set(id, file);
    return file;
  }

  // Workspace Files (in-memory stub)
  private workspaceFilesMap = new Map<string, WorkspaceFile>();
  
  async getWorkspaceFiles(filters?: { jobId?: string; contactId?: string; type?: string }): Promise<WorkspaceFile[]> {
    let files = Array.from(this.workspaceFilesMap.values());
    
    if (filters?.jobId) {
      files = files.filter(f => f.jobId === filters.jobId);
    }
    if (filters?.contactId) {
      files = files.filter(f => f.contactId === filters.contactId);
    }
    if (filters?.type) {
      files = files.filter(f => f.type === filters.type);
    }
    
    return files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async getWorkspaceFile(id: string): Promise<WorkspaceFile | undefined> {
    return this.workspaceFilesMap.get(id);
  }
  
  async getWorkspaceFileByGoogleId(googleFileId: string): Promise<WorkspaceFile | undefined> {
    return Array.from(this.workspaceFilesMap.values()).find(f => f.googleFileId === googleFileId);
  }
  
  async createWorkspaceFile(insertFile: InsertWorkspaceFile): Promise<WorkspaceFile> {
    const id = randomUUID();
    const file: WorkspaceFile = {
      id,
      googleFileId: insertFile.googleFileId,
      name: insertFile.name,
      type: insertFile.type,
      url: insertFile.url,
      jobId: insertFile.jobId ?? null,
      contactId: insertFile.contactId ?? null,
      lastModifiedBy: insertFile.lastModifiedBy ?? null,
      lastModifiedTime: insertFile.lastModifiedTime ?? null,
      status: insertFile.status ?? "active",
      metadata: insertFile.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workspaceFilesMap.set(id, file);
    return file;
  }
  
  async updateWorkspaceFile(id: string, update: Partial<InsertWorkspaceFile>): Promise<WorkspaceFile | undefined> {
    const file = this.workspaceFilesMap.get(id);
    if (!file) return undefined;
    const updated = { ...file, ...update, updatedAt: new Date() };
    this.workspaceFilesMap.set(id, updated as WorkspaceFile);
    return updated as WorkspaceFile;
  }
  
  async deleteWorkspaceFile(id: string): Promise<boolean> {
    return this.workspaceFilesMap.delete(id);
  }

  async getAuditLog(): Promise<AuditLogEntry[]> {
    return this.auditLogs;
  }

  async createAuditLogEntry(insertEntry: InsertAuditLogEntry): Promise<AuditLogEntry> {
    const id = randomUUID();
    const entry: AuditLogEntry = {
      id,
      userId: insertEntry.userId ?? null,
      action: insertEntry.action,
      entityType: insertEntry.entityType ?? null,
      entityId: insertEntry.entityId ?? null,
      details: insertEntry.details ?? null,
      timestamp: new Date(),
    };
    this.auditLogs.push(entry);
    return entry;
  }

  async getEstimates(): Promise<Estimate[]> {
    return Array.from(this.estimates.values());
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    return this.estimates.get(id);
  }

  async createEstimate(insertEstimate: InsertEstimate): Promise<Estimate> {
    const id = randomUUID();
    const estimate: Estimate = {
      id,
      contactId: insertEstimate.contactId,
      jobId: insertEstimate.jobId ?? null,
      status: insertEstimate.status ?? "draft",
      lineItems: insertEstimate.lineItems ?? null,
      subtotal: insertEstimate.subtotal ?? "0",
      taxTotal: insertEstimate.taxTotal ?? "0",
      totalAmount: insertEstimate.totalAmount ?? "0",
      validUntil: insertEstimate.validUntil ?? null,
      notes: insertEstimate.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.estimates.set(id, estimate);
    return estimate;
  }

  async updateEstimate(id: string, update: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    const estimate = this.estimates.get(id);
    if (!estimate) return undefined;
    const updated = { ...estimate, ...update, updatedAt: new Date() };
    this.estimates.set(id, updated);
    return updated;
  }

  async deleteEstimate(id: string): Promise<boolean> {
    return this.estimates.delete(id);
  }

  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = {
      id,
      jobId: insertInvoice.jobId,
      contactId: insertInvoice.contactId,
      estimateId: insertInvoice.estimateId ?? null,
      status: insertInvoice.status ?? "draft",
      lineItems: insertInvoice.lineItems ?? null,
      subtotal: insertInvoice.subtotal ?? "0",
      taxTotal: insertInvoice.taxTotal ?? "0",
      totalAmount: insertInvoice.totalAmount ?? "0",
      issuedAt: insertInvoice.issuedAt ?? null,
      dueAt: insertInvoice.dueAt ?? null,
      paidAt: insertInvoice.paidAt ?? null,
      notes: insertInvoice.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, update: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    const updated = { ...invoice, ...update, updatedAt: new Date() };
    this.invoices.set(id, updated);
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  async getPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = {
      id,
      invoiceId: insertPayment.invoiceId,
      amount: insertPayment.amount,
      method: insertPayment.method ?? "cash",
      transactionRef: insertPayment.transactionRef ?? null,
      status: insertPayment.status ?? "pending",
      paidAt: insertPayment.paidAt ?? null,
      createdAt: new Date(),
    };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: string, update: Partial<InsertPayment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    const updated = { ...payment, ...update };
    this.payments.set(id, updated);
    return updated;
  }

  async getPaymentSlips(): Promise<PaymentSlip[]> {
    return Array.from(this.paymentSlipsMap.values());
  }

  async getPaymentSlip(id: string): Promise<PaymentSlip | undefined> {
    return this.paymentSlipsMap.get(id);
  }

  async createPaymentSlip(slip: InsertPaymentSlip): Promise<PaymentSlip> {
    const id = randomUUID();
    const now = new Date();
    const newSlip: PaymentSlip = {
      ...slip,
      id,
      status: slip.status || "draft",
      origin: slip.origin || "human",
      stripeIntentId: slip.stripeIntentId || null,
      processorRef: slip.processorRef || null,
      approvedBy: slip.approvedBy || null,
      approvedAt: slip.approvedAt || null,
      sentAt: slip.sentAt || null,
      completedAt: slip.completedAt || null,
      failedAt: slip.failedAt || null,
      failureReason: slip.failureReason || null,
      createdAt: now,
      updatedAt: now,
    };
    this.paymentSlipsMap.set(id, newSlip);
    return newSlip;
  }

  async updatePaymentSlip(id: string, update: Partial<InsertPaymentSlip>): Promise<PaymentSlip | undefined> {
    const slip = this.paymentSlipsMap.get(id);
    if (!slip) return undefined;
    const updated = { ...slip, ...update, updatedAt: new Date() };
    this.paymentSlipsMap.set(id, updated);
    return updated;
  }

  async getAiReflections(): Promise<AiReflection[]> {
    return Array.from(this.aiReflections.values());
  }

  async getAiReflection(id: string): Promise<AiReflection | undefined> {
    return this.aiReflections.get(id);
  }

  async createAiReflection(insertReflection: InsertAiReflection): Promise<AiReflection> {
    const id = randomUUID();
    const reflection: AiReflection = {
      id,
      assistQueueId: insertReflection.assistQueueId ?? null,
      auditLogId: insertReflection.auditLogId ?? null,
      userRequest: insertReflection.userRequest,
      initialPlan: insertReflection.initialPlan ?? null,
      reflectionPrompt: insertReflection.reflectionPrompt,
      reflectionOutput: insertReflection.reflectionOutput,
      revisedPlan: insertReflection.revisedPlan ?? null,
      approved: insertReflection.approved ?? false,
      executedAt: insertReflection.executedAt ?? null,
      createdAt: new Date(),
    };
    this.aiReflections.set(id, reflection);
    return reflection;
  }

  async getAiTasks(): Promise<AiTask[]> {
    return Array.from(this.aiTasksMap.values());
  }

  async getAiTask(id: string): Promise<AiTask | undefined> {
    return this.aiTasksMap.get(id);
  }

  async createAiTask(insertTask: InsertAiTask): Promise<AiTask> {
    const id = randomUUID();
    const task: AiTask = {
      id,
      assistQueueId: insertTask.assistQueueId ?? null,
      auditLogId: insertTask.auditLogId ?? null,
      taskType: insertTask.taskType,
      delegatedTo: insertTask.delegatedTo ?? "neo8",
      payload: insertTask.payload,
      status: insertTask.status ?? "pending",
      result: insertTask.result ?? null,
      error: insertTask.error ?? null,
      retryCount: insertTask.retryCount ?? 0,
      attemptedAt: insertTask.attemptedAt ?? null,
      createdAt: new Date(),
      completedAt: insertTask.completedAt ?? null,
    };
    this.aiTasksMap.set(id, task);
    return task;
  }

  async updateAiTask(id: string, update: Partial<InsertAiTask>): Promise<AiTask | undefined> {
    const task = this.aiTasksMap.get(id);
    if (!task) return undefined;
    const updated = { 
      ...task, 
      ...update,
      completedAt: update.status === "completed" ? new Date() : task.completedAt,
      attemptedAt: update.status === "in_progress" ? new Date() : task.attemptedAt,
    };
    this.aiTasksMap.set(id, updated);
    return updated;
  }

  async getAssistQueue(): Promise<AssistQueueEntry[]> {
    return Array.from(this.assistQueueMap.values());
  }

  async getAssistQueueEntry(id: string): Promise<AssistQueueEntry | undefined> {
    return this.assistQueueMap.get(id);
  }

  async createAssistQueueEntry(insertEntry: InsertAssistQueueEntry): Promise<AssistQueueEntry> {
    const id = randomUUID();
    const entry: AssistQueueEntry = {
      id,
      userId: insertEntry.userId ?? null,
      mode: insertEntry.mode,
      userRequest: insertEntry.userRequest,
      status: insertEntry.status ?? "pending",
      agentResponse: insertEntry.agentResponse ?? null,
      toolsCalled: insertEntry.toolsCalled ?? null,
      toolResults: insertEntry.toolResults ?? null,
      requiresApproval: insertEntry.requiresApproval ?? false,
      approvedBy: insertEntry.approvedBy ?? null,
      approvedAt: insertEntry.approvedAt ?? null,
      rejectedBy: insertEntry.rejectedBy ?? null,
      rejectedAt: insertEntry.rejectedAt ?? null,
      executedAt: insertEntry.executedAt ?? null,
      completedAt: insertEntry.completedAt ?? null,
      error: insertEntry.error ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.assistQueueMap.set(id, entry);
    return entry;
  }

  async updateAssistQueueEntry(id: string, update: Partial<InsertAssistQueueEntry>): Promise<AssistQueueEntry | undefined> {
    const entry = this.assistQueueMap.get(id);
    if (!entry) return undefined;
    const updated = { 
      ...entry, 
      ...update, 
      updatedAt: new Date(),
      executedAt: update.executedAt !== undefined ? update.executedAt :
                  (update.status === "in_progress" && !entry.executedAt ? new Date() : entry.executedAt),
      completedAt: update.completedAt !== undefined ? update.completedAt :
                   (update.status === "completed" ? new Date() : entry.completedAt),
    };
    this.assistQueueMap.set(id, updated);
    return updated;
  }

  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversationsMap.values());
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversationsMap.get(id);
  }

  async getConversationByContact(contactId: string): Promise<Conversation[]> {
    return Array.from(this.conversationsMap.values()).filter(
      conv => conv.contactId === contactId
    );
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      id,
      contactId: insertConversation.contactId ?? null,
      status: insertConversation.status ?? "active",
      channel: insertConversation.channel ?? "widget",
      sessionToken: insertConversation.sessionToken ?? null,
      leadScore: insertConversation.leadScore ?? null,
      lastMessageAt: insertConversation.lastMessageAt ?? null,
      metadata: insertConversation.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversationsMap.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: string, update: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const conversation = this.conversationsMap.get(id);
    if (!conversation) return undefined;
    const updated = { ...conversation, ...update, updatedAt: new Date() };
    this.conversationsMap.set(id, updated);
    return updated;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messagesMap.values()).filter(
      msg => msg.conversationId === conversationId
    );
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messagesMap.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const createdAt = new Date();
    const message: Message = {
      id,
      conversationId: insertMessage.conversationId,
      role: insertMessage.role,
      content: insertMessage.content,
      metadata: insertMessage.metadata ?? {},
      createdAt,
    };
    this.messagesMap.set(id, message);
    
    const conversation = this.conversationsMap.get(insertMessage.conversationId);
    if (conversation) {
      conversation.lastMessageAt = createdAt;
      conversation.updatedAt = createdAt;
      this.conversationsMap.set(conversation.id, conversation);
    }
    
    return message;
  }

  async getMemoryEntries(conversationId?: string, contactId?: string): Promise<MemoryEntry[]> {
    let entries = Array.from(this.memoryEntriesMap.values());
    
    if (conversationId) {
      entries = entries.filter(entry => entry.conversationId === conversationId);
    }
    
    if (contactId) {
      entries = entries.filter(entry => entry.contactId === contactId);
    }
    
    return entries;
  }

  async createMemoryEntry(insertEntry: InsertMemoryEntry): Promise<MemoryEntry> {
    const id = randomUUID();
    const entry: MemoryEntry = {
      id,
      conversationId: insertEntry.conversationId ?? null,
      contactId: insertEntry.contactId ?? null,
      content: insertEntry.content,
      summary: insertEntry.summary ?? null,
      embedding: insertEntry.embedding ?? null,
      importance: insertEntry.importance ?? 5,
      metadata: insertEntry.metadata ?? {},
      createdAt: new Date(),
    };
    this.memoryEntriesMap.set(id, entry);
    return entry;
  }

  async searchMemory(query: string, contactId?: string): Promise<MemoryEntry[]> {
    const lowerQuery = query.toLowerCase();
    let entries = Array.from(this.memoryEntriesMap.values());
    
    entries = entries.filter(entry => 
      entry.content.toLowerCase().includes(lowerQuery) ||
      (entry.summary && entry.summary.toLowerCase().includes(lowerQuery))
    );
    
    if (contactId) {
      entries = entries.filter(entry => entry.contactId === contactId);
    }
    
    return entries;
  }

  async searchMemorySimilarity(
    queryEmbedding: number[],
    contactId?: string,
    conversationId?: string,
    limit: number = 10
  ): Promise<Array<{ entry: MemoryEntry; similarity: number }>> {
    let entries = Array.from(this.memoryEntriesMap.values());
    
    if (contactId) {
      entries = entries.filter(entry => entry.contactId === contactId);
    }
    
    if (conversationId) {
      entries = entries.filter(entry => entry.conversationId === conversationId);
    }

    const results = entries
      .map(entry => {
        if (!entry.embedding) {
          return { entry, similarity: 0 };
        }
        
        const embedding = typeof entry.embedding === 'string' 
          ? JSON.parse(entry.embedding) as number[]
          : entry.embedding as unknown as number[];
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return { entry, similarity };
      })
      .filter(r => r.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async getSettings(): Promise<Settings | undefined> {
    return this.settingsData;
  }

  async updateSettings(update: Partial<InsertSettings>): Promise<Settings> {
    const current = this.settingsData || {
      id: 'default',
      agentMode: 'assist',
      autoEmail: true,
      autoSchedule: true,
      autoStatus: false,
      companyName: 'Smart Klix CRM',
      primaryColor: '#FDB913',
      secondaryColor: '#1E40AF',
      logoUrl: null,
      n8nWebhookUrl: null,
      openaiApiKey: null,
      stripeSecretKey: null,
      twilioAccountSid: null,
      twilioAuthToken: null,
      sendgridApiKey: null,
      smsTemplateAppointment: null,
      smsTemplateInvoice: null,
      emailTemplateEstimate: null,
      updatedAt: new Date(),
    };
    
    this.settingsData = {
      ...current,
      ...update,
      updatedAt: new Date(),
    };
    
    return this.settingsData;
  }

  async getAiSettings(): Promise<AiSettings | undefined> {
    return undefined; // MemStorage doesn't persist AI settings
  }

  async updateAiSettings(config: Partial<InsertAiSettings>): Promise<AiSettings> {
    const aiSettingsData: AiSettings = {
      id: 'default',
      edgeAgentPrompt: config.edgeAgentPrompt || null,
      edgeAgentConstraints: config.edgeAgentConstraints || [],
      edgeAgentEnabled: config.edgeAgentEnabled ?? true,
      discoveryAiPrompt: config.discoveryAiPrompt || null,
      discoveryAiConstraints: config.discoveryAiConstraints || [],
      discoveryAiEnabled: config.discoveryAiEnabled ?? true,
      actionAiPrompt: config.actionAiPrompt || null,
      actionAiConstraints: config.actionAiConstraints || [],
      actionAiEnabled: config.actionAiEnabled ?? true,
      masterArchitectPrompt: config.masterArchitectPrompt || null,
      masterArchitectConstraints: config.masterArchitectConstraints || [],
      masterArchitectEnabled: config.masterArchitectEnabled ?? true,
      companyKnowledge: config.companyKnowledge || null,
      globalEnabled: config.globalEnabled ?? true,
      updatedAt: new Date(),
    };
    return aiSettingsData;
  }

  async getMasterArchitectConfig(): Promise<MasterArchitectConfig | undefined> {
    return this.masterArchitectConfigData;
  }

  async updateMasterArchitectConfig(config: Partial<InsertMasterArchitectConfig>): Promise<MasterArchitectConfig> {
    const current: MasterArchitectConfig = this.masterArchitectConfigData || {
      id: 'default',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1500,
      topP: 1.0,
      frequencyPenalty: 0.0,
      systemPrompt: 'You are a helpful AI assistant for the Smart Klix CRM.',
      reflectionEnabled: true,
      maxReflectionRounds: 1,
      recursionDepthLimit: 3,
      maxConversationHistory: 50,
      contextSummarizationEnabled: false,
      autoPruneAfterMessages: 100,
      toolPermissions: {},
      channelToolPermissions: {},
      updatedAt: new Date(),
    };

    this.masterArchitectConfigData = {
      ...current,
      ...config,
      updatedAt: new Date(),
    };

    return this.masterArchitectConfigData;
  }

  async getWebhookEvents(limit?: number): Promise<WebhookEvent[]> {
    const events = [...this.webhookEventsArray].reverse();
    return limit ? events.slice(0, limit) : events;
  }

  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const webhookEvent: WebhookEvent = {
      id: randomUUID(),
      url: event.url,
      method: event.method || 'POST',
      payload: event.payload || null,
      statusCode: event.statusCode || null,
      responseBody: event.responseBody || null,
      errorMessage: event.errorMessage || null,
      duration: event.duration || null,
      createdAt: new Date(),
    };
    this.webhookEventsArray.push(webhookEvent);
    return webhookEvent;
  }

  async getAiVoiceDispatchConfig(): Promise<AiVoiceDispatchConfig | undefined> {
    return this.aiVoiceDispatchConfigData;
  }

  async updateAiVoiceDispatchConfig(config: Partial<InsertAiVoiceDispatchConfig>): Promise<AiVoiceDispatchConfig> {
    const current: AiVoiceDispatchConfig = this.aiVoiceDispatchConfigData || {
      id: 'default',
      enabled: false,
      voiceServerUrl: null,
      webhookSecret: null,
      storeTranscript: true,
      autoCreateContact: true,
      autoCreateNote: true,
      maxCallDuration: 300,
      useOutsideBusinessHours: true,
      updatedAt: new Date(),
    };

    this.aiVoiceDispatchConfigData = {
      ...current,
      ...config,
      updatedAt: new Date(),
    };

    return this.aiVoiceDispatchConfigData;
  }

  async getCompanyInstructions(): Promise<CompanyInstructions[]> {
    return Array.from(this.companyInstructionsMap.values());
  }

  async getCompanyInstructionsById(id: string): Promise<CompanyInstructions | undefined> {
    return this.companyInstructionsMap.get(id);
  }

  async getCompanyInstructionsByName(name: string): Promise<CompanyInstructions | undefined> {
    return Array.from(this.companyInstructionsMap.values()).find(
      (ci) => ci.companyName.toLowerCase() === name.toLowerCase()
    );
  }

  async createCompanyInstructions(instructions: InsertCompanyInstructions): Promise<CompanyInstructions> {
    const id = randomUUID();
    const companyInstructionsEntry: CompanyInstructions = {
      id,
      companyName: instructions.companyName,
      behaviorInstructions: instructions.behaviorInstructions || null,
      activeChannels: instructions.activeChannels || { crm_chat: true, widget: true, voice: false, gpt_actions: false },
      defaultPipelineStage: instructions.defaultPipelineStage || 'lead_intake',
      defaultTags: instructions.defaultTags || [],
      toolPermissionOverrides: instructions.toolPermissionOverrides || {},
      customFlags: instructions.customFlags || {},
      isActive: instructions.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.companyInstructionsMap.set(id, companyInstructionsEntry);
    return companyInstructionsEntry;
  }

  async updateCompanyInstructions(id: string, instructions: Partial<InsertCompanyInstructions>): Promise<CompanyInstructions | undefined> {
    const existing = this.companyInstructionsMap.get(id);
    if (!existing) return undefined;
    const updated: CompanyInstructions = {
      ...existing,
      ...instructions,
      updatedAt: new Date(),
    };
    this.companyInstructionsMap.set(id, updated);
    return updated;
  }

  async deleteCompanyInstructions(id: string): Promise<boolean> {
    return this.companyInstructionsMap.delete(id);
  }

  // Email Accounts
  async getEmailAccounts(): Promise<EmailAccount[]> {
    return Array.from(this.emailAccountsMap.values());
  }

  async getEmailAccount(id: string): Promise<EmailAccount | undefined> {
    return this.emailAccountsMap.get(id);
  }

  async getEmailAccountByAddress(emailAddress: string): Promise<EmailAccount | undefined> {
    const lowerEmail = emailAddress.toLowerCase();
    return Array.from(this.emailAccountsMap.values()).find(
      a => a.emailAddress.toLowerCase() === lowerEmail
    );
  }

  async createEmailAccount(account: InsertEmailAccount): Promise<EmailAccount> {
    const id = randomUUID();
    const emailAccount: EmailAccount = {
      id,
      displayName: account.displayName,
      emailAddress: account.emailAddress,
      incomingHost: account.incomingHost || null,
      incomingPort: account.incomingPort ?? 993,
      incomingSsl: account.incomingSsl ?? true,
      outgoingHost: account.outgoingHost || null,
      outgoingPort: account.outgoingPort ?? 587,
      outgoingSsl: account.outgoingSsl ?? true,
      username: account.username || null,
      encryptedPassword: account.encryptedPassword || null,
      status: account.status || 'disconnected',
      direction: account.direction || 'send_receive',
      defaultCompany: account.defaultCompany || null,
      lastSyncAt: account.lastSyncAt || null,
      errorMessage: account.errorMessage || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.emailAccountsMap.set(id, emailAccount);
    return emailAccount;
  }

  async updateEmailAccount(id: string, account: Partial<InsertEmailAccount>): Promise<EmailAccount | undefined> {
    const existing = this.emailAccountsMap.get(id);
    if (!existing) return undefined;
    const updated: EmailAccount = { ...existing, ...account, updatedAt: new Date() };
    this.emailAccountsMap.set(id, updated);
    return updated;
  }

  async deleteEmailAccount(id: string): Promise<boolean> {
    return this.emailAccountsMap.delete(id);
  }

  // Emails
  async getEmails(filters?: { accountId?: string; direction?: string; status?: string; limit?: number }): Promise<Email[]> {
    let results = Array.from(this.emailsMap.values());
    if (filters?.accountId) results = results.filter(e => e.accountId === filters.accountId);
    if (filters?.direction) results = results.filter(e => e.direction === filters.direction);
    if (filters?.status) results = results.filter(e => e.status === filters.status);
    results.sort((a, b) => (b.receivedAt?.getTime() || b.createdAt.getTime()) - (a.receivedAt?.getTime() || a.createdAt.getTime()));
    if (filters?.limit) results = results.slice(0, filters.limit);
    return results;
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.emailsMap.get(id);
  }

  async createEmail(email: InsertEmail): Promise<Email> {
    const id = randomUUID();
    const newEmail: Email = {
      id,
      accountId: email.accountId,
      messageId: email.messageId || null,
      threadId: email.threadId || null,
      direction: email.direction || 'incoming',
      fromAddress: email.fromAddress,
      toAddresses: email.toAddresses || [],
      ccAddresses: email.ccAddresses || [],
      bccAddresses: email.bccAddresses || [],
      subject: email.subject || null,
      bodyHtml: email.bodyHtml || null,
      bodyText: email.bodyText || null,
      attachments: email.attachments || [],
      status: email.status || 'synced',
      contactId: email.contactId || null,
      jobId: email.jobId || null,
      company: email.company || null,
      receivedAt: email.receivedAt || null,
      sentAt: email.sentAt || null,
      isRead: email.isRead ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.emailsMap.set(id, newEmail);
    return newEmail;
  }

  async updateEmail(id: string, email: Partial<InsertEmail>): Promise<Email | undefined> {
    const existing = this.emailsMap.get(id);
    if (!existing) return undefined;
    const updated: Email = { ...existing, ...email, updatedAt: new Date() };
    this.emailsMap.set(id, updated);
    return updated;
  }

  async deleteEmail(id: string): Promise<boolean> {
    return this.emailsMap.delete(id);
  }

  // WhatsApp Messages
  private whatsappMessagesMap: Map<string, WhatsappMessage> = new Map();

  async getWhatsappMessages(filters?: { contactId?: string; direction?: string; status?: string; limit?: number }): Promise<WhatsappMessage[]> {
    let results = Array.from(this.whatsappMessagesMap.values());
    if (filters?.contactId) results = results.filter(m => m.contactId === filters.contactId);
    if (filters?.direction) results = results.filter(m => m.direction === filters.direction);
    if (filters?.status) results = results.filter(m => m.status === filters.status);
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (filters?.limit) results = results.slice(0, filters.limit);
    return results;
  }

  async getWhatsappMessage(id: string): Promise<WhatsappMessage | undefined> {
    return this.whatsappMessagesMap.get(id);
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const id = randomUUID();
    const whatsappMessage: WhatsappMessage = {
      id,
      contactId: message.contactId ?? null,
      jobId: message.jobId ?? null,
      direction: message.direction ?? 'outgoing',
      fromPhone: message.fromPhone,
      toPhone: message.toPhone,
      body: message.body,
      messageSid: message.messageSid ?? null,
      conversationId: message.conversationId ?? null,
      status: message.status ?? 'queued',
      mediaUrl: message.mediaUrl ?? null,
      mediaContentType: message.mediaContentType ?? null,
      templateId: message.templateId ?? null,
      errorMessage: message.errorMessage ?? null,
      sentAt: message.sentAt ?? null,
      deliveredAt: message.deliveredAt ?? null,
      createdAt: new Date(),
    };
    this.whatsappMessagesMap.set(id, whatsappMessage);
    return whatsappMessage;
  }

  async updateWhatsappMessage(id: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage | undefined> {
    const existing = this.whatsappMessagesMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...message };
    this.whatsappMessagesMap.set(id, updated);
    return updated;
  }

  async deleteWhatsappMessage(id: string): Promise<boolean> {
    return this.whatsappMessagesMap.delete(id);
  }

  // Intakes
  async getIntakes(): Promise<Intake[]> {
    return Array.from(this.intakesMap.values());
  }

  async getIntake(id: string): Promise<Intake | undefined> {
    return this.intakesMap.get(id);
  }

  async getIntakeByWebhookToken(token: string): Promise<Intake | undefined> {
    return Array.from(this.intakesMap.values()).find(i => i.webhookToken === token);
  }

  async createIntake(intake: InsertIntake): Promise<Intake> {
    const id = randomUUID();
    const newIntake: Intake = {
      id,
      name: intake.name,
      company: intake.company || null,
      channelType: intake.channelType || 'web',
      active: intake.active ?? true,
      defaultPipelineStage: intake.defaultPipelineStage || 'lead_intake',
      defaultContactTags: intake.defaultContactTags || [],
      defaultJobTags: intake.defaultJobTags || [],
      contactMatchBehavior: intake.contactMatchBehavior || 'match_or_create',
      createJobBehavior: intake.createJobBehavior || 'always',
      aiInstructions: intake.aiInstructions || null,
      webhookToken: intake.webhookToken || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.intakesMap.set(id, newIntake);
    return newIntake;
  }

  async updateIntake(id: string, intake: Partial<InsertIntake>): Promise<Intake | undefined> {
    const existing = this.intakesMap.get(id);
    if (!existing) return undefined;
    const updated: Intake = { ...existing, ...intake, updatedAt: new Date() };
    this.intakesMap.set(id, updated);
    return updated;
  }

  async deleteIntake(id: string): Promise<boolean> {
    return this.intakesMap.delete(id);
  }

  // Intake Fields
  async getIntakeFields(intakeId: string): Promise<IntakeField[]> {
    return Array.from(this.intakeFieldsMap.values())
      .filter(f => f.intakeId === intakeId)
      .sort((a, b) => a.fieldOrder - b.fieldOrder);
  }

  async getIntakeField(id: string): Promise<IntakeField | undefined> {
    return this.intakeFieldsMap.get(id);
  }

  async createIntakeField(field: InsertIntakeField): Promise<IntakeField> {
    const id = randomUUID();
    const newField: IntakeField = {
      id,
      intakeId: field.intakeId,
      label: field.label,
      key: field.key,
      type: field.type || 'text',
      required: field.required ?? false,
      helpText: field.helpText || null,
      options: field.options || [],
      fieldOrder: field.fieldOrder ?? 0,
      mappedEntity: field.mappedEntity || null,
      mappedFieldKey: field.mappedFieldKey || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.intakeFieldsMap.set(id, newField);
    return newField;
  }

  async updateIntakeField(id: string, field: Partial<InsertIntakeField>): Promise<IntakeField | undefined> {
    const existing = this.intakeFieldsMap.get(id);
    if (!existing) return undefined;
    const updated: IntakeField = { ...existing, ...field, updatedAt: new Date() };
    this.intakeFieldsMap.set(id, updated);
    return updated;
  }

  async deleteIntakeField(id: string): Promise<boolean> {
    return this.intakeFieldsMap.delete(id);
  }

  // Intake Submissions
  async getIntakeSubmissions(intakeId?: string): Promise<IntakeSubmission[]> {
    let results = Array.from(this.intakeSubmissionsMap.values());
    if (intakeId) results = results.filter(s => s.intakeId === intakeId);
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getIntakeSubmission(id: string): Promise<IntakeSubmission | undefined> {
    return this.intakeSubmissionsMap.get(id);
  }

  async createIntakeSubmission(submission: InsertIntakeSubmission): Promise<IntakeSubmission> {
    const id = randomUUID();
    const newSubmission: IntakeSubmission = {
      id,
      intakeId: submission.intakeId,
      payload: submission.payload || {},
      contactId: submission.contactId || null,
      jobId: submission.jobId || null,
      status: submission.status || 'pending',
      errorMessage: submission.errorMessage || null,
      processedAt: submission.processedAt || null,
      createdAt: new Date(),
    };
    this.intakeSubmissionsMap.set(id, newSubmission);
    return newSubmission;
  }

  async updateIntakeSubmission(id: string, submission: Partial<InsertIntakeSubmission>): Promise<IntakeSubmission | undefined> {
    const existing = this.intakeSubmissionsMap.get(id);
    if (!existing) return undefined;
    const updated: IntakeSubmission = { ...existing, ...submission };
    this.intakeSubmissionsMap.set(id, updated);
    return updated;
  }

  // Events Outbox
  async getEventsOutbox(): Promise<EventsOutbox[]> {
    return Array.from(this.eventsOutboxMap.values());
  }

  async getEventsOutboxByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<EventsOutbox | undefined> {
    return Array.from(this.eventsOutboxMap.values()).find(
      e => e.tenantId === tenantId && e.idempotencyKey === idempotencyKey
    );
  }

  async createEventsOutbox(entry: InsertEventsOutbox): Promise<EventsOutbox> {
    const id = randomUUID();
    const newEntry: EventsOutbox = {
      id,
      tenantId: entry.tenantId,
      idempotencyKey: entry.idempotencyKey,
      schemaVersion: entry.schemaVersion || '1.0',
      eventType: entry.eventType,
      channel: entry.channel,
      sourceId: entry.sourceId || null,
      sourceIp: entry.sourceIp || null,
      recordingUrl: entry.recordingUrl || null,
      leadScore: entry.leadScore || null,
      payload: entry.payload,
      status: entry.status || 'pending',
      dispatchedAt: entry.dispatchedAt || null,
      errorMessage: entry.errorMessage || null,
      retryCount: entry.retryCount || 0,
      createdAt: new Date(),
    };
    this.eventsOutboxMap.set(id, newEntry);
    return newEntry;
  }

  async updateEventsOutboxStatus(id: string, status: string, errorMessage?: string): Promise<EventsOutbox | undefined> {
    const existing = this.eventsOutboxMap.get(id);
    if (!existing) return undefined;
    const updated: EventsOutbox = { 
      ...existing, 
      status, 
      errorMessage: errorMessage || existing.errorMessage,
      dispatchedAt: status === 'dispatched' ? new Date() : existing.dispatchedAt
    };
    this.eventsOutboxMap.set(id, updated);
    return updated;
  }

  async getPendingEventsOutbox(limit: number = 10): Promise<EventsOutbox[]> {
    const pending = Array.from(this.eventsOutboxMap.values())
      .filter(e => e.status === 'pending' || e.status === 'retry')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
    return pending;
  }

  async updateEventsOutboxForRetry(id: string, retryCount: number, status: string, dispatchedAt?: Date, errorMessage?: string): Promise<EventsOutbox | undefined> {
    const existing = this.eventsOutboxMap.get(id);
    if (!existing) return undefined;
    const updated: EventsOutbox = { 
      ...existing, 
      retryCount,
      status, 
      dispatchedAt: dispatchedAt || existing.dispatchedAt,
      errorMessage: errorMessage || existing.errorMessage,
    };
    this.eventsOutboxMap.set(id, updated);
    return updated;
  }
}

export class DbStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    if (!db) return [];
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getContacts(): Promise<Contact[]> {
    if (!db) return [];
    return await db.select().from(contacts);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(contacts).where(eq(contacts.phone, phone));
    return result[0];
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(contacts).where(eq(contacts.email, email));
    return result[0];
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(contacts).values(insertContact).returning();
    return result[0];
  }

  async updateContact(id: string, update: Partial<InsertContact>): Promise<Contact | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(contacts)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return result[0];
  }

  async deleteContact(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(contacts).where(eq(contacts.id, id));
    return true;
  }

  async getJobs(): Promise<Job[]> {
    if (!db) return [];
    return await db.select().from(jobs);
  }

  async getJob(id: string): Promise<Job | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(jobs).where(eq(jobs.id, id));
    return result[0];
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(jobs).values(insertJob).returning();
    return result[0];
  }

  async updateJob(id: string, update: Partial<InsertJob>): Promise<Job | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(jobs)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return result[0];
  }

  async getAppointments(): Promise<Appointment[]> {
    if (!db) return [];
    return await db.select().from(appointments);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(appointments).values(insertAppointment).returning();
    return result[0];
  }

  async getNotes(): Promise<Note[]> {
    if (!db) return [];
    return await db.select().from(notes);
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(notes).values(insertNote).returning();
    return result[0];
  }

  async updateNote(id: string, update: Partial<InsertNote>): Promise<Note | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(notes)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();
    return result[0];
  }

  async deleteNote(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(notes).where(eq(notes.id, id));
    return true;
  }

  async getFiles(): Promise<FileRecord[]> {
    if (!db) return [];
    return await db.select().from(files);
  }

  async createFile(insertFile: InsertFileRecord): Promise<FileRecord> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(files).values(insertFile).returning();
    return result[0];
  }

  // Workspace Files (Google Workspace Artifact Mirror)
  async getWorkspaceFiles(filters?: { jobId?: string; contactId?: string; type?: string }): Promise<WorkspaceFile[]> {
    if (!db) return [];
    let query = db.select().from(workspaceFiles);
    
    const conditions = [];
    if (filters?.jobId) {
      conditions.push(eq(workspaceFiles.jobId, filters.jobId));
    }
    if (filters?.contactId) {
      conditions.push(eq(workspaceFiles.contactId, filters.contactId));
    }
    if (filters?.type) {
      conditions.push(eq(workspaceFiles.type, filters.type));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(workspaceFiles).where(and(...conditions)).orderBy(desc(workspaceFiles.updatedAt));
    }
    return await db.select().from(workspaceFiles).orderBy(desc(workspaceFiles.updatedAt));
  }

  async getWorkspaceFile(id: string): Promise<WorkspaceFile | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(workspaceFiles).where(eq(workspaceFiles.id, id));
    return result[0];
  }

  async getWorkspaceFileByGoogleId(googleFileId: string): Promise<WorkspaceFile | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(workspaceFiles).where(eq(workspaceFiles.googleFileId, googleFileId));
    return result[0];
  }

  async createWorkspaceFile(insertFile: InsertWorkspaceFile): Promise<WorkspaceFile> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(workspaceFiles).values(insertFile).returning();
    return result[0];
  }

  async updateWorkspaceFile(id: string, update: Partial<InsertWorkspaceFile>): Promise<WorkspaceFile | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(workspaceFiles)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(workspaceFiles.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkspaceFile(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(workspaceFiles).where(eq(workspaceFiles.id, id));
    return true;
  }

  async getAuditLog(): Promise<AuditLogEntry[]> {
    if (!db) return [];
    return await db.select().from(auditLog);
  }

  async createAuditLogEntry(insertEntry: InsertAuditLogEntry): Promise<AuditLogEntry> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(auditLog).values(insertEntry).returning();
    return result[0];
  }

  async getEstimates(): Promise<Estimate[]> {
    if (!db) return [];
    return await db.select().from(estimates);
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(estimates).where(eq(estimates.id, id));
    return result[0];
  }

  async createEstimate(insertEstimate: InsertEstimate): Promise<Estimate> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(estimates).values(insertEstimate).returning();
    return result[0];
  }

  async updateEstimate(id: string, update: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(estimates)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(estimates.id, id))
      .returning();
    return result[0];
  }

  async deleteEstimate(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(estimates).where(eq(estimates.id, id));
    return true;
  }

  async getInvoices(): Promise<Invoice[]> {
    if (!db) return [];
    return await db.select().from(invoices);
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(invoices).values(insertInvoice).returning();
    return result[0];
  }

  async updateInvoice(id: string, update: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(invoices)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return result[0];
  }

  async deleteInvoice(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(invoices).where(eq(invoices.id, id));
    return true;
  }

  async getPayments(): Promise<Payment[]> {
    if (!db) return [];
    return await db.select().from(payments);
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(payments).where(eq(payments.id, id));
    return result[0];
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(payments).values(insertPayment).returning();
    return result[0];
  }

  async updatePayment(id: string, update: Partial<InsertPayment>): Promise<Payment | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(payments)
      .set(update)
      .where(eq(payments.id, id))
      .returning();
    return result[0];
  }

  async getPaymentSlips(): Promise<PaymentSlip[]> {
    if (!db) return [];
    return await db.select().from(paymentSlips);
  }

  async getPaymentSlip(id: string): Promise<PaymentSlip | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(paymentSlips).where(eq(paymentSlips.id, id));
    return result[0];
  }

  async createPaymentSlip(slip: InsertPaymentSlip): Promise<PaymentSlip> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(paymentSlips).values(slip).returning();
    return result[0];
  }

  async updatePaymentSlip(id: string, update: Partial<InsertPaymentSlip>): Promise<PaymentSlip | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(paymentSlips)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(paymentSlips.id, id))
      .returning();
    return result[0];
  }

  async getAiReflections(): Promise<AiReflection[]> {
    if (!db) return [];
    return await db.select().from(aiReflection);
  }

  async getAiReflection(id: string): Promise<AiReflection | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(aiReflection).where(eq(aiReflection.id, id));
    return result[0];
  }

  async createAiReflection(insertReflection: InsertAiReflection): Promise<AiReflection> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(aiReflection).values(insertReflection).returning();
    return result[0];
  }

  async getAiTasks(): Promise<AiTask[]> {
    if (!db) return [];
    return await db.select().from(aiTasks);
  }

  async getAiTask(id: string): Promise<AiTask | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(aiTasks).where(eq(aiTasks.id, id));
    return result[0];
  }

  async createAiTask(insertTask: InsertAiTask): Promise<AiTask> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(aiTasks).values(insertTask).returning();
    return result[0];
  }

  async updateAiTask(id: string, update: Partial<InsertAiTask>): Promise<AiTask | undefined> {
    if (!db) return undefined;
    const updates: Record<string, any> = { ...update };
    if (update.status === "completed") {
      updates.completedAt = new Date();
    }
    if (update.status === "in_progress") {
      updates.attemptedAt = new Date();
    }
    const result = await db
      .update(aiTasks)
      .set(updates)
      .where(eq(aiTasks.id, id))
      .returning();
    return result[0];
  }

  async getAssistQueue(): Promise<AssistQueueEntry[]> {
    if (!db) return [];
    return await db.select().from(assistQueue);
  }

  async getAssistQueueEntry(id: string): Promise<AssistQueueEntry | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(assistQueue).where(eq(assistQueue.id, id));
    return result[0];
  }

  async createAssistQueueEntry(insertEntry: InsertAssistQueueEntry): Promise<AssistQueueEntry> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(assistQueue).values(insertEntry).returning();
    return result[0];
  }

  async updateAssistQueueEntry(id: string, update: Partial<InsertAssistQueueEntry>): Promise<AssistQueueEntry | undefined> {
    if (!db) return undefined;
    const updates: Record<string, any> = { ...update, updatedAt: new Date() };
    if (!update.executedAt && update.status === "in_progress") {
      const current = await this.getAssistQueueEntry(id);
      if (current && !current.executedAt) {
        updates.executedAt = new Date();
      }
    }
    if (!update.completedAt && update.status === "completed") {
      updates.completedAt = new Date();
    }
    const result = await db
      .update(assistQueue)
      .set(updates)
      .where(eq(assistQueue.id, id))
      .returning();
    return result[0];
  }

  async getConversations(): Promise<Conversation[]> {
    if (!db) return [];
    return await db.select().from(conversations);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getConversationByContact(contactId: string): Promise<Conversation[]> {
    if (!db) return [];
    return await db.select().from(conversations).where(eq(conversations.contactId, contactId));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async updateConversation(id: string, update: Partial<InsertConversation>): Promise<Conversation | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(conversations)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!db) return [];
    return await db.select().from(messages).where(eq(messages.conversationId, conversationId));
  }

  async getMessage(id: string): Promise<Message | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0];
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(messages).values(insertMessage).returning();
    const message = result[0];
    
    await db.update(conversations)
      .set({ 
        lastMessageAt: message.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, insertMessage.conversationId));
    
    return message;
  }

  async getMemoryEntries(conversationId?: string, contactId?: string): Promise<MemoryEntry[]> {
    if (!db) return [];
    
    if (conversationId && contactId) {
      return await db.select().from(memoryEntries).where(
        and(
          eq(memoryEntries.conversationId, conversationId),
          eq(memoryEntries.contactId, contactId)
        )
      );
    } else if (conversationId) {
      return await db.select().from(memoryEntries).where(eq(memoryEntries.conversationId, conversationId));
    } else if (contactId) {
      return await db.select().from(memoryEntries).where(eq(memoryEntries.contactId, contactId));
    }
    
    return await db.select().from(memoryEntries);
  }

  async createMemoryEntry(insertEntry: InsertMemoryEntry): Promise<MemoryEntry> {
    if (!db) throw new Error("Database not connected");
    
    if (insertEntry.embedding) {
      const { embedding, ...rest } = insertEntry;
      const result = await db.execute(sql`
        INSERT INTO memory_entries (
          conversation_id, contact_id, content, summary, embedding, importance, metadata
        ) VALUES (
          ${rest.conversationId}, 
          ${rest.contactId}, 
          ${rest.content}, 
          ${rest.summary}, 
          ${embedding}::vector,
          ${rest.importance ?? 5}, 
          ${rest.metadata ? JSON.stringify(rest.metadata) : '{}'}::jsonb
        ) RETURNING *
      `);
      const rawRow = result.rows[0] as any;
      return {
        id: rawRow.id,
        conversationId: rawRow.conversation_id,
        contactId: rawRow.contact_id,
        content: rawRow.content,
        summary: rawRow.summary,
        embedding: rawRow.embedding,
        importance: rawRow.importance,
        metadata: rawRow.metadata,
        createdAt: new Date(rawRow.created_at),
      };
    }
    
    const result = await db.insert(memoryEntries).values(insertEntry).returning();
    return result[0];
  }

  async searchMemory(query: string, contactId?: string): Promise<MemoryEntry[]> {
    if (!db) return [];
    
    const searchPattern = `%${query}%`;
    const searchCondition = or(
      like(memoryEntries.content, searchPattern),
      like(memoryEntries.summary, searchPattern)
    );
    
    if (contactId) {
      return await db.select().from(memoryEntries).where(
        and(
          searchCondition,
          eq(memoryEntries.contactId, contactId)
        )
      );
    }
    
    return await db.select().from(memoryEntries).where(searchCondition);
  }

  async searchMemorySimilarity(
    queryEmbedding: number[],
    contactId?: string,
    conversationId?: string,
    limit: number = 10
  ): Promise<Array<{ entry: MemoryEntry; similarity: number }>> {
    if (!db) return [];

    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const conditions = [sql`${memoryEntries.embedding} IS NOT NULL`];
    if (contactId) {
      conditions.push(eq(memoryEntries.contactId, contactId));
    }
    if (conversationId) {
      conditions.push(eq(memoryEntries.conversationId, conversationId));
    }

    const rawResults = await db.execute(sql`
      SELECT 
        *,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM memory_entries
      WHERE embedding IS NOT NULL
        ${contactId ? sql`AND contact_id = ${contactId}` : sql``}
        ${conversationId ? sql`AND conversation_id = ${conversationId}` : sql``}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return rawResults.rows.map((row: any) => ({
      entry: {
        id: row.id,
        conversationId: row.conversation_id,
        contactId: row.contact_id,
        content: row.content,
        summary: row.summary,
        embedding: row.embedding,
        importance: row.importance,
        metadata: row.metadata,
        createdAt: new Date(row.created_at),
      },
      similarity: parseFloat(row.similarity),
    }));
  }

  async getSettings(): Promise<Settings | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(settings).where(eq(settings.id, 'default'));
    return result[0];
  }

  async updateSettings(update: Partial<InsertSettings>): Promise<Settings> {
    if (!db) throw new Error("Database not connected");
    
    const existing = await this.getSettings();
    
    if (existing) {
      const result = await db
        .update(settings)
        .set({ ...update, updatedAt: new Date() })
        .where(eq(settings.id, 'default'))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(settings)
        .values({ ...update, id: 'default', updatedAt: new Date() })
        .returning();
      return result[0];
    }
  }

  async getAiSettings(): Promise<AiSettings | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(aiSettings).where(eq(aiSettings.id, 'default'));
    return result[0];
  }

  async updateAiSettings(config: Partial<InsertAiSettings>): Promise<AiSettings> {
    if (!db) throw new Error("Database not connected");
    
    const result = await db
      .insert(aiSettings)
      .values({ 
        id: 'default', 
        ...config,
        updatedAt: new Date()
      } as typeof aiSettings.$inferInsert)
      .onConflictDoUpdate({
        target: aiSettings.id,
        set: {
          ...config,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async getMasterArchitectConfig(): Promise<MasterArchitectConfig | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(masterArchitectConfig).where(eq(masterArchitectConfig.id, 'default'));
    return result[0];
  }

  async updateMasterArchitectConfig(config: Partial<InsertMasterArchitectConfig>): Promise<MasterArchitectConfig> {
    if (!db) throw new Error("Database not connected");

    // Use UPSERT to ensure atomic operation and singleton row
    const result = await db
      .insert(masterArchitectConfig)
      .values({ 
        id: 'default', 
        ...config,
        updatedAt: new Date()
      } as InsertMasterArchitectConfig)
      .onConflictDoUpdate({
        target: masterArchitectConfig.id,
        set: {
          ...config,
          updatedAt: new Date(),
        },
      })
      .returning();
      
    return result[0];
  }

  async getWebhookEvents(limit?: number): Promise<WebhookEvent[]> {
    if (!db) return [];
    const query = db.select().from(webhookEvents).orderBy(sql`${webhookEvents.createdAt} DESC`);
    const result = limit ? await query.limit(limit) : await query;
    return result;
  }

  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(webhookEvents).values(event).returning();
    return result[0];
  }

  // AI Voice Dispatch Config - dispatch metadata only (no AI behavior)
  async getAiVoiceDispatchConfig(): Promise<AiVoiceDispatchConfig | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(aiVoiceDispatchConfig).where(eq(aiVoiceDispatchConfig.id, 'default'));
    return result[0];
  }

  async updateAiVoiceDispatchConfig(config: Partial<InsertAiVoiceDispatchConfig>): Promise<AiVoiceDispatchConfig> {
    if (!db) throw new Error("Database not connected");

    const result = await db
      .insert(aiVoiceDispatchConfig)
      .values({ 
        id: 'default', 
        ...config,
        updatedAt: new Date()
      } as typeof aiVoiceDispatchConfig.$inferInsert)
      .onConflictDoUpdate({
        target: aiVoiceDispatchConfig.id,
        set: {
          ...config,
          updatedAt: new Date(),
        },
      })
      .returning();
      
    return result[0];
  }

  async getCompanyInstructions(): Promise<CompanyInstructions[]> {
    if (!db) return [];
    return await db.select().from(companyInstructions);
  }

  async getCompanyInstructionsById(id: string): Promise<CompanyInstructions | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(companyInstructions).where(eq(companyInstructions.id, id));
    return result[0];
  }

  async getCompanyInstructionsByName(name: string): Promise<CompanyInstructions | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(companyInstructions).where(
      sql`LOWER(${companyInstructions.companyName}) = LOWER(${name})`
    );
    return result[0];
  }

  async createCompanyInstructions(instructions: InsertCompanyInstructions): Promise<CompanyInstructions> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(companyInstructions).values(instructions).returning();
    return result[0];
  }

  async updateCompanyInstructions(id: string, instructions: Partial<InsertCompanyInstructions>): Promise<CompanyInstructions | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(companyInstructions)
      .set({ ...instructions, updatedAt: new Date() })
      .where(eq(companyInstructions.id, id))
      .returning();
    return result[0];
  }

  async deleteCompanyInstructions(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(companyInstructions).where(eq(companyInstructions.id, id));
    return true;
  }

  // Email Accounts
  async getEmailAccounts(): Promise<EmailAccount[]> {
    if (!db) return [];
    return await db.select().from(emailAccounts);
  }

  async getEmailAccount(id: string): Promise<EmailAccount | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(emailAccounts).where(eq(emailAccounts.id, id));
    return result[0];
  }

  async getEmailAccountByAddress(emailAddress: string): Promise<EmailAccount | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(emailAccounts).where(
      sql`LOWER(${emailAccounts.emailAddress}) = LOWER(${emailAddress})`
    );
    return result[0];
  }

  async createEmailAccount(account: InsertEmailAccount): Promise<EmailAccount> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(emailAccounts).values(account).returning();
    return result[0];
  }

  async updateEmailAccount(id: string, account: Partial<InsertEmailAccount>): Promise<EmailAccount | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(emailAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(emailAccounts.id, id))
      .returning();
    return result[0];
  }

  async deleteEmailAccount(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
    return true;
  }

  // Emails
  async getEmails(filters?: { accountId?: string; direction?: string; status?: string; limit?: number }): Promise<Email[]> {
    if (!db) return [];
    let query = db.select().from(emails);
    const conditions = [];
    if (filters?.accountId) conditions.push(eq(emails.accountId, filters.accountId));
    if (filters?.direction) conditions.push(eq(emails.direction, filters.direction));
    if (filters?.status) conditions.push(eq(emails.status, filters.status));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const results = await query;
    results.sort((a, b) => (b.receivedAt?.getTime() || b.createdAt.getTime()) - (a.receivedAt?.getTime() || a.createdAt.getTime()));
    if (filters?.limit) return results.slice(0, filters.limit);
    return results;
  }

  async getEmail(id: string): Promise<Email | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(emails).where(eq(emails.id, id));
    return result[0];
  }

  async createEmail(email: InsertEmail): Promise<Email> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(emails).values(email).returning();
    return result[0];
  }

  async updateEmail(id: string, email: Partial<InsertEmail>): Promise<Email | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(emails)
      .set({ ...email, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning();
    return result[0];
  }

  async deleteEmail(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(emails).where(eq(emails.id, id));
    return true;
  }

  // WhatsApp Messages
  async getWhatsappMessages(filters?: { contactId?: string; direction?: string; status?: string; limit?: number }): Promise<WhatsappMessage[]> {
    if (!db) return [];
    let query = db.select().from(whatsappMessages);
    const conditions = [];
    if (filters?.contactId) conditions.push(eq(whatsappMessages.contactId, filters.contactId));
    if (filters?.direction) conditions.push(eq(whatsappMessages.direction, filters.direction));
    if (filters?.status) conditions.push(eq(whatsappMessages.status, filters.status));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const results = await query;
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (filters?.limit) return results.slice(0, filters.limit);
    return results;
  }

  async getWhatsappMessage(id: string): Promise<WhatsappMessage | undefined> {
    if (!db) return undefined;
    const [msg] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id));
    return msg;
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    if (!db) throw new Error("Database not connected");
    const [result] = await db.insert(whatsappMessages).values(message).returning();
    return result;
  }

  async updateWhatsappMessage(id: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage | undefined> {
    if (!db) return undefined;
    const [result] = await db.update(whatsappMessages).set(message).where(eq(whatsappMessages.id, id)).returning();
    return result;
  }

  async deleteWhatsappMessage(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(whatsappMessages).where(eq(whatsappMessages.id, id));
    return true;
  }

  // Intakes
  async getIntakes(): Promise<Intake[]> {
    if (!db) return [];
    return await db.select().from(intakes);
  }

  async getIntake(id: string): Promise<Intake | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(intakes).where(eq(intakes.id, id));
    return result[0];
  }

  async getIntakeByWebhookToken(token: string): Promise<Intake | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(intakes).where(eq(intakes.webhookToken, token));
    return result[0];
  }

  async createIntake(intake: InsertIntake): Promise<Intake> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(intakes).values(intake).returning();
    return result[0];
  }

  async updateIntake(id: string, intake: Partial<InsertIntake>): Promise<Intake | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(intakes)
      .set({ ...intake, updatedAt: new Date() })
      .where(eq(intakes.id, id))
      .returning();
    return result[0];
  }

  async deleteIntake(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(intakes).where(eq(intakes.id, id));
    return true;
  }

  // Intake Fields
  async getIntakeFields(intakeId: string): Promise<IntakeField[]> {
    if (!db) return [];
    const results = await db.select().from(intakeFields).where(eq(intakeFields.intakeId, intakeId));
    return results.sort((a, b) => a.fieldOrder - b.fieldOrder);
  }

  async getIntakeField(id: string): Promise<IntakeField | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(intakeFields).where(eq(intakeFields.id, id));
    return result[0];
  }

  async createIntakeField(field: InsertIntakeField): Promise<IntakeField> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(intakeFields).values(field).returning();
    return result[0];
  }

  async updateIntakeField(id: string, field: Partial<InsertIntakeField>): Promise<IntakeField | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(intakeFields)
      .set({ ...field, updatedAt: new Date() })
      .where(eq(intakeFields.id, id))
      .returning();
    return result[0];
  }

  async deleteIntakeField(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(intakeFields).where(eq(intakeFields.id, id));
    return true;
  }

  // Intake Submissions
  async getIntakeSubmissions(intakeId?: string): Promise<IntakeSubmission[]> {
    if (!db) return [];
    if (intakeId) {
      const results = await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.intakeId, intakeId));
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    const results = await db.select().from(intakeSubmissions);
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getIntakeSubmission(id: string): Promise<IntakeSubmission | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.id, id));
    return result[0];
  }

  async createIntakeSubmission(submission: InsertIntakeSubmission): Promise<IntakeSubmission> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(intakeSubmissions).values(submission).returning();
    return result[0];
  }

  async updateIntakeSubmission(id: string, submission: Partial<InsertIntakeSubmission>): Promise<IntakeSubmission | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(intakeSubmissions)
      .set(submission)
      .where(eq(intakeSubmissions.id, id))
      .returning();
    return result[0];
  }

  // Locations
  async getLocations(contactId?: string): Promise<Location[]> {
    if (!db) return [];
    if (contactId) {
      return await db.select().from(locations).where(eq(locations.contactId, contactId));
    }
    return await db.select().from(locations);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(locations).values(location).returning();
    return result[0];
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(locations)
      .set({ ...location, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return result[0];
  }

  async deleteLocation(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(locations).where(eq(locations.id, id));
    return true;
  }

  // Equipment
  async getEquipment(locationId?: string): Promise<Equipment[]> {
    if (!db) return [];
    if (locationId) {
      return await db.select().from(equipment).where(eq(equipment.locationId, locationId));
    }
    return await db.select().from(equipment);
  }

  async getEquipmentItem(id: string): Promise<Equipment | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(equipment).where(eq(equipment.id, id));
    return result[0];
  }

  async createEquipment(equip: InsertEquipment): Promise<Equipment> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(equipment).values(equip).returning();
    return result[0];
  }

  async updateEquipment(id: string, equip: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(equipment)
      .set({ ...equip, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    return result[0];
  }

  async deleteEquipment(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(equipment).where(eq(equipment.id, id));
    return true;
  }

  // Pricebook
  async getPricebookItems(filters?: { category?: string; tier?: string; active?: boolean }): Promise<PricebookItem[]> {
    if (!db) return [];
    let query = db.select().from(pricebookItems);
    const conditions: any[] = [];
    if (filters?.category) conditions.push(eq(pricebookItems.category, filters.category));
    if (filters?.tier) conditions.push(eq(pricebookItems.tier, filters.tier));
    if (filters?.active !== undefined) conditions.push(eq(pricebookItems.active, filters.active));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query;
  }

  async getPricebookItem(id: string): Promise<PricebookItem | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(pricebookItems).where(eq(pricebookItems.id, id));
    return result[0];
  }

  async createPricebookItem(item: InsertPricebookItem): Promise<PricebookItem> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(pricebookItems).values(item).returning();
    return result[0];
  }

  async updatePricebookItem(id: string, item: Partial<InsertPricebookItem>): Promise<PricebookItem | undefined> {
    if (!db) return undefined;
    const result = await db
      .update(pricebookItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(pricebookItems.id, id))
      .returning();
    return result[0];
  }

  async deletePricebookItem(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(pricebookItems).where(eq(pricebookItems.id, id));
    return true;
  }

  // Tags
  async getTags(): Promise<Tag[]> {
    if (!db) return [];
    return await db.select().from(tags);
  }

  async getTag(id: string): Promise<Tag | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(tags).where(eq(tags.id, id));
    return result[0];
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(tags).values(tag).returning();
    return result[0];
  }

  async deleteTag(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(tags).where(eq(tags.id, id));
    return true;
  }

  // Stored Payment Methods
  async getStoredPaymentMethods(contactId: string): Promise<StoredPaymentMethod[]> {
    if (!db) return [];
    return await db.select().from(storedPaymentMethods).where(eq(storedPaymentMethods.contactId, contactId));
  }

  async getStoredPaymentMethod(id: string): Promise<StoredPaymentMethod | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(storedPaymentMethods).where(eq(storedPaymentMethods.id, id));
    return result[0];
  }

  async createStoredPaymentMethod(pm: InsertStoredPaymentMethod): Promise<StoredPaymentMethod> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(storedPaymentMethods).values(pm).returning();
    return result[0];
  }

  async deleteStoredPaymentMethod(id: string): Promise<boolean> {
    if (!db) return false;
    await db.delete(storedPaymentMethods).where(eq(storedPaymentMethods.id, id));
    return true;
  }

  // Duplicate Detection - fuzzy matching on name/email/phone
  async findDuplicateContacts(name?: string, email?: string, phone?: string): Promise<Contact[]> {
    if (!db) return [];
    const conditions: any[] = [];
    if (email) conditions.push(eq(contacts.email, email));
    if (phone) conditions.push(eq(contacts.phone, phone));
    if (name) conditions.push(like(contacts.name, `%${name}%`));
    if (conditions.length === 0) return [];
    const results = await db.select().from(contacts).where(or(...conditions));
    return results;
  }

  // Events Outbox
  async getEventsOutbox(): Promise<EventsOutbox[]> {
    if (!db) return [];
    return await db.select().from(eventsOutbox).orderBy(eventsOutbox.createdAt);
  }

  async getEventsOutboxByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<EventsOutbox | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(eventsOutbox)
      .where(and(eq(eventsOutbox.tenantId, tenantId), eq(eventsOutbox.idempotencyKey, idempotencyKey)));
    return result[0];
  }

  async createEventsOutbox(entry: InsertEventsOutbox): Promise<EventsOutbox> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(eventsOutbox).values(entry).returning();
    return result[0];
  }

  async updateEventsOutboxStatus(id: string, status: string, errorMessage?: string): Promise<EventsOutbox | undefined> {
    if (!db) return undefined;
    const updates: Partial<InsertEventsOutbox> = { status };
    if (errorMessage) updates.errorMessage = errorMessage;
    if (status === 'dispatched') updates.dispatchedAt = new Date();
    const result = await db.update(eventsOutbox).set(updates).where(eq(eventsOutbox.id, id)).returning();
    return result[0];
  }

  async getPendingEventsOutbox(limit: number = 10): Promise<EventsOutbox[]> {
    if (!db) return [];
    return await db.select().from(eventsOutbox)
      .where(or(eq(eventsOutbox.status, 'pending'), eq(eventsOutbox.status, 'retry')))
      .orderBy(eventsOutbox.createdAt)
      .limit(limit);
  }

  async updateEventsOutboxForRetry(id: string, retryCount: number, status: string, dispatchedAt?: Date, errorMessage?: string): Promise<EventsOutbox | undefined> {
    if (!db) return undefined;
    const updates: Partial<InsertEventsOutbox> = { 
      retryCount, 
      status,
    };
    if (dispatchedAt) updates.dispatchedAt = dispatchedAt;
    if (errorMessage) updates.errorMessage = errorMessage;
    const result = await db.update(eventsOutbox).set(updates).where(eq(eventsOutbox.id, id)).returning();
    return result[0];
  }

  // ========================================
  // Automation Ledger
  // ========================================
  async getAutomationLedgerEntries(filters?: { agentName?: string; actionType?: string; mode?: string; status?: string; limit?: number }): Promise<AutomationLedger[]> {
    if (!db) return [];
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.agentName) conditions.push(eq(automationLedger.agentName, filters.agentName));
    if (filters?.actionType) conditions.push(eq(automationLedger.actionType, filters.actionType));
    if (filters?.mode) conditions.push(eq(automationLedger.mode, filters.mode));
    if (filters?.status) conditions.push(eq(automationLedger.status, filters.status));
    
    const query = db.select().from(automationLedger);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(automationLedger.timestamp)).limit(filters?.limit ?? 100);
    }
    return await query.orderBy(desc(automationLedger.timestamp)).limit(filters?.limit ?? 100);
  }

  async getAutomationLedgerEntry(id: string): Promise<AutomationLedger | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(automationLedger).where(eq(automationLedger.id, id));
    return result[0];
  }

  async getAutomationLedgerByIdempotencyKey(idempotencyKey: string): Promise<AutomationLedger | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(automationLedger).where(eq(automationLedger.idempotencyKey, idempotencyKey));
    return result[0];
  }

  async createAutomationLedgerEntry(entry: InsertAutomationLedger): Promise<AutomationLedger> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(automationLedger).values(entry).returning();
    return result[0];
  }

  async updateAutomationLedgerEntry(id: string, updates: Partial<InsertAutomationLedger>): Promise<AutomationLedger | undefined> {
    if (!db) return undefined;
    const result = await db.update(automationLedger)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(automationLedger.id, id))
      .returning();
    return result[0];
  }

  // ========================================
  // Voice Dispatch Logs
  // ========================================
  async getVoiceDispatchLogs(): Promise<VoiceDispatchLog[]> {
    if (!db) return [];
    return await db.select().from(voiceDispatchLogs).orderBy(desc(voiceDispatchLogs.createdAt)).limit(100);
  }

  async getVoiceDispatchLog(id: string): Promise<VoiceDispatchLog | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(voiceDispatchLogs).where(eq(voiceDispatchLogs.id, id));
    return result[0];
  }

  async createVoiceDispatchLog(log: InsertVoiceDispatchLog): Promise<VoiceDispatchLog> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(voiceDispatchLogs).values(log).returning();
    return result[0];
  }

  async updateVoiceDispatchLog(id: string, updates: Partial<InsertVoiceDispatchLog>): Promise<VoiceDispatchLog | undefined> {
    if (!db) return undefined;
    const result = await db.update(voiceDispatchLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(voiceDispatchLogs.id, id))
      .returning();
    return result[0];
  }
}

export const storage: IStorage = isDatabaseConnected() ? new DbStorage() : new MemStorage();
