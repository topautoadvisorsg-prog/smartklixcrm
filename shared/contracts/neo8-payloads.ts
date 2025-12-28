import { z } from "zod";

export const FollowUpTriggerPayloadSchema = z.object({
  contactId: z.string().uuid(),
  channel: z.enum(["sms", "email", "both"]),
  templateId: z.string().optional(),
  intent: z.string().optional(),
  meetingLink: z.string().url().optional(),
  delayMinutes: z.number().int().min(0).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  metadata: z.record(z.string()).optional(),
});

export type FollowUpTriggerPayload = z.infer<typeof FollowUpTriggerPayloadSchema>;

export const AIReceptionistEconomicPayloadSchema = z.object({
  callId: z.string(),
  callerId: z.string(),
  contactId: z.string().uuid().optional(),
  voiceMode: z.literal("economic"),
  transcript: z.string(),
  intent: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type AIReceptionistEconomicPayload = z.infer<typeof AIReceptionistEconomicPayloadSchema>;

export const AIReceptionistPremiumPayloadSchema = z.object({
  callId: z.string(),
  callerId: z.string(),
  contactId: z.string().uuid().optional(),
  voiceMode: z.literal("premium"),
  sessionId: z.string(),
  timestamp: z.string().datetime(),
});

export type AIReceptionistPremiumPayload = z.infer<typeof AIReceptionistPremiumPayloadSchema>;

export const AIReceptionistPayloadSchema = z.discriminatedUnion("voiceMode", [
  AIReceptionistEconomicPayloadSchema,
  AIReceptionistPremiumPayloadSchema,
]);

export type AIReceptionistPayload = z.infer<typeof AIReceptionistPayloadSchema>;

export const MasterArchitectCallbackActionSchema = z.enum(["APPROVE", "RETRY", "ESCALATE"]);

export const MasterArchitectCallbackPayloadSchema = z.object({
  action: MasterArchitectCallbackActionSchema,
  taskId: z.string().uuid(),
  queueItemId: z.string().uuid().optional(),
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(1),
  escalationThreshold: z.number().int().min(1).optional(),
  reason: z.string().optional(),
  reviewedBy: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type MasterArchitectCallbackPayload = z.infer<typeof MasterArchitectCallbackPayloadSchema>;

export const GoogleWorkspaceActionSchema = z.enum([
  "gmail.send",
  "gmail.reply",
  "calendar.create",
  "calendar.update",
  "calendar.cancel",
  "sheets.append",
  "docs.create",
  "docs.update",
  "docs.append",
  "docs.replace",
  "docs.export",
]);

export const GoogleGmailPayloadSchema = z.object({
  action: z.enum(["gmail.send", "gmail.reply"]),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  threadId: z.string().optional(),
  contactId: z.string().uuid().optional(),
});

export type GoogleGmailPayload = z.infer<typeof GoogleGmailPayloadSchema>;

const CalendarBaseSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendees: z.array(z.string().email()).optional(),
  contactId: z.string().uuid().optional(),
});

export const GoogleCalendarCreatePayloadSchema = CalendarBaseSchema.extend({
  action: z.literal("calendar.create"),
});

export const GoogleCalendarUpdatePayloadSchema = CalendarBaseSchema.extend({
  action: z.literal("calendar.update"),
  eventId: z.string(),
});

export const GoogleCalendarCancelPayloadSchema = z.object({
  action: z.literal("calendar.cancel"),
  eventId: z.string(),
  contactId: z.string().uuid().optional(),
});

export type GoogleCalendarPayload = 
  | z.infer<typeof GoogleCalendarCreatePayloadSchema>
  | z.infer<typeof GoogleCalendarUpdatePayloadSchema>
  | z.infer<typeof GoogleCalendarCancelPayloadSchema>;

export const GoogleSheetsPayloadSchema = z.object({
  action: z.literal("sheets.append"),
  spreadsheetId: z.string(),
  sheetName: z.string(),
  values: z.array(z.array(z.string())),
  contactId: z.string().uuid().optional(),
});

export type GoogleSheetsPayload = z.infer<typeof GoogleSheetsPayloadSchema>;

export const GoogleDocsCreatePayloadSchema = z.object({
  action: z.literal("docs.create"),
  title: z.string(),
  content: z.string().optional(),
  contactId: z.string().uuid().optional(),
});

export const GoogleDocsUpdatePayloadSchema = z.object({
  action: z.literal("docs.update"),
  documentId: z.string(),
  content: z.string(),
  contactId: z.string().uuid().optional(),
});

export const GoogleDocsAppendPayloadSchema = z.object({
  action: z.literal("docs.append"),
  documentId: z.string(),
  content: z.string(),
  contactId: z.string().uuid().optional(),
});

export const GoogleDocsReplacePayloadSchema = z.object({
  action: z.literal("docs.replace"),
  documentId: z.string(),
  placeholders: z.record(z.string()),
  contactId: z.string().uuid().optional(),
});

export const GoogleDocsExportPayloadSchema = z.object({
  action: z.literal("docs.export"),
  documentId: z.string(),
  exportFormat: z.enum(["pdf", "plain"]),
  contactId: z.string().uuid().optional(),
});

export type GoogleDocsPayload = 
  | z.infer<typeof GoogleDocsCreatePayloadSchema>
  | z.infer<typeof GoogleDocsUpdatePayloadSchema>
  | z.infer<typeof GoogleDocsAppendPayloadSchema>
  | z.infer<typeof GoogleDocsReplacePayloadSchema>
  | z.infer<typeof GoogleDocsExportPayloadSchema>;

export const GoogleWorkspacePayloadSchema = z.discriminatedUnion("action", [
  GoogleGmailPayloadSchema.extend({ action: z.literal("gmail.send") }),
  GoogleGmailPayloadSchema.extend({ action: z.literal("gmail.reply") }),
  GoogleCalendarCreatePayloadSchema,
  GoogleCalendarUpdatePayloadSchema,
  GoogleCalendarCancelPayloadSchema,
  GoogleSheetsPayloadSchema,
  GoogleDocsCreatePayloadSchema,
  GoogleDocsUpdatePayloadSchema,
  GoogleDocsAppendPayloadSchema,
  GoogleDocsReplacePayloadSchema,
  GoogleDocsExportPayloadSchema,
]);

export type GoogleWorkspacePayload = z.infer<typeof GoogleWorkspacePayloadSchema>;

export const Neo8ExecutionResultSchema = z.object({
  success: z.boolean(),
  executionId: z.string(),
  timestamp: z.string().datetime(),
  error: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export type Neo8ExecutionResult = z.infer<typeof Neo8ExecutionResultSchema>;

export const WhatsAppOutboundPayloadSchema = z.object({
  action: z.literal("whatsapp.send"),
  contactId: z.string().uuid(),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, "E.164 phone format required"),
  message: z.string().min(1).max(4096),
  channel: z.enum(["whatsapp", "sms"]),
  templateId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  metadata: z.record(z.string()).optional(),
});

export type WhatsAppOutboundPayload = z.infer<typeof WhatsAppOutboundPayloadSchema>;

export const WhatsAppInboundPayloadSchema = z.object({
  channel: z.literal("whatsapp"),
  from: z.string(),
  to: z.string(),
  body: z.string(),
  messageSid: z.string(),
  timestamp: z.string().datetime(),
  mediaUrl: z.string().url().optional(),
  mediaContentType: z.string().optional(),
  rawPayload: z.record(z.unknown()).optional(),
});

export type WhatsAppInboundPayload = z.infer<typeof WhatsAppInboundPayloadSchema>;

// Premium AI Receptionist Call Result (Neo8 → CRM)
export const PremiumReceptionistResultPayloadSchema = z.object({
  callId: z.string(),
  contactId: z.string().uuid().optional(),
  callerPhone: z.string(),
  transcript: z.string(),
  summary: z.string(),
  extractedData: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    reason: z.string().optional(),
    appointmentRequested: z.boolean().optional(),
    preferredTime: z.string().optional(),
    urgency: z.enum(["low", "normal", "high", "urgent"]).optional(),
    notes: z.string().optional(),
  }),
  callDuration: z.number().int().min(0),
  callOutcome: z.enum(["completed", "transferred", "voicemail", "dropped", "error"]).optional(),
  timestamp: z.string().datetime(),
});

export type PremiumReceptionistResultPayload = z.infer<typeof PremiumReceptionistResultPayloadSchema>;

// Voice Call Events (AI Receptionist Server → Neo8 → CRM)
export const VoiceEventPayloadSchema = z.object({
  eventType: z.enum(["scheduled", "answered", "missed", "completed", "transferred", "voicemail"]),
  callId: z.string(),
  contactId: z.string().uuid().optional(),
  callerPhone: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.string()).optional(),
  callDuration: z.number().int().min(0).optional(),
  outcome: z.string().optional(),
});

export type VoiceEventPayload = z.infer<typeof VoiceEventPayloadSchema>;

// Voice Receptionist Config Response (CRM → Premium Server)
export const VoiceReceptionistConfigResponseSchema = z.object({
  enabled: z.boolean(),
  voiceMode: z.enum(["economy", "premium"]),
  operatingMode: z.enum(["inbound_only", "inbound_outbound"]),
  llmModel: z.string(),
  sttProvider: z.string(),
  ttsProvider: z.string(),
  ttsVoice: z.string(),
  languagePreference: z.string(),
  allowedIntents: z.record(z.boolean()),
  maxCallDuration: z.number(),
  maxFailedUnderstandings: z.number(),
  toolPermissions: z.record(z.object({
    enabled: z.boolean(),
    allowedModes: z.array(z.string()),
  })),
  failedAttemptsBeforeHandoff: z.number(),
  fallbackBehavior: z.enum(["take_message", "voicemail", "transfer"]),
  storeTranscript: z.boolean(),
  autoCreateContact: z.boolean(),
  autoCreateNote: z.boolean(),
});

export type VoiceReceptionistConfigResponse = z.infer<typeof VoiceReceptionistConfigResponseSchema>;

