/**
 * N8N Event Utilities
 * 
 * Handles sending events to n8n webhooks for external integrations.
 * Each event type triggers a different workflow (SMS, Email, Payment Links, etc.)
 * 
 * Architecture: Dashboard → Backend API → n8n webhook → External service
 *               → n8n calls back to /api/events/update with result
 * 
 * Note: N8N events are now routed through the backend to avoid exposing
 * webhook URLs in client-side code. Use the backend /api/n8n/dispatch endpoint.
 */

/**
 * Event types supported by the SmartKlix Event workflow
 */
export type N8NEventType = 
  | "send_sms"
  | "send_email"
  | "create_payment_link"
  | "new_lead"
  | "missed_call";

/**
 * Base event structure for all n8n events
 */
export interface N8NEvent {
  event_type: N8NEventType;
  contact_id?: string;
  phone_number?: string;
  email?: string;
  message?: string;
  subject?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sends an event to the SmartKlix n8n webhook via backend API
 * 
 * @param event - Event data to send
 * @returns Promise with dispatch result
 * @throws Error if dispatch fails
 */
export async function sendN8NEvent(event: N8NEvent): Promise<void> {
  const metadata = event.metadata || {};
  
  const response = await fetch("/api/n8n/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType: event.event_type,
      eventId: crypto.randomUUID(),
      toNumber: event.phone_number || "",
      toEmail: event.email || "",
      message: event.message || "",
      subject: event.subject || "",
      customerId: event.contact_id || "",
      amount: String(metadata.amount || ""),
      productName: String(metadata.productName || metadata.description || ""),
      paymentSourceId: String(metadata.invoice_id || metadata.job_id || ""),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`N8N dispatch failed: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "N8N dispatch failed");
  }
}

/**
 * Sends an SMS via n8n → Twilio integration
 * 
 * @param contactId - CRM contact ID
 * @param phoneNumber - Recipient phone number (E.164 format)
 * @param message - SMS message text
 * @param metadata - Additional context (job_id, estimate_id, etc.)
 */
export async function sendSMS(
  contactId: string,
  phoneNumber: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await sendN8NEvent({
    event_type: "send_sms",
    contact_id: contactId,
    phone_number: phoneNumber,
    message,
    metadata: {
      ...metadata,
      triggered_by: "dashboard",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Sends an email via n8n → SendGrid integration
 * 
 * @param contactId - CRM contact ID
 * @param email - Recipient email address
 * @param subject - Email subject line
 * @param message - Email body (HTML or plain text)
 * @param metadata - Additional context
 */
export async function sendEmail(
  contactId: string,
  email: string,
  subject: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await sendN8NEvent({
    event_type: "send_email",
    contact_id: contactId,
    email,
    subject,
    message,
    metadata: {
      ...metadata,
      triggered_by: "dashboard",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Creates a payment link via n8n → Stripe integration
 * 
 * @param contactId - CRM contact ID
 * @param email - Customer email for payment link
 * @param metadata - Payment details (amount, description, invoice_id, etc.)
 */
export async function createPaymentLink(
  contactId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await sendN8NEvent({
    event_type: "create_payment_link",
    contact_id: contactId,
    email,
    metadata: {
      ...metadata,
      triggered_by: "dashboard",
      timestamp: new Date().toISOString(),
    },
  });
}
