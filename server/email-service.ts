/**
 * Email Service - Abstraction layer for email providers
 * Currently using Resend, can be swapped for Brevo/Mailgun
 */

import { Resend } from 'resend';
import { log } from './vite';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  // Tracking metadata for webhook correlation
  metadata?: {
    campaignId: string;
    recipientId: string;
    contactId: string;
  };
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private static instance: EmailService;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!resend) {
      log('⚠️  RESEND_API_KEY not configured - email not sent');
      return {
        success: false,
        error: 'Email provider not configured',
      };
    }

    try {
      const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
      const fromName = process.env.FROM_NAME || 'Smart Klix CRM';

      const data = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        replyTo: message.replyTo,
        // Pass tracking metadata for webhook correlation
        tags: message.metadata ? [
          { name: 'campaignId', value: message.metadata.campaignId },
          { name: 'recipientId', value: message.metadata.recipientId },
          { name: 'contactId', value: message.metadata.contactId },
        ] : [],
      });

      log(`✅ Email sent to ${message.to} (ID: ${data.data?.id})`);

      return {
        success: true,
        messageId: data.data?.id,
      };
    } catch (error: any) {
      log(`❌ Email failed to ${message.to}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Batch send (Resend supports up to 50 recipients per call)
  async sendBatch(messages: EmailMessage[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    // Process in batches of 50
    for (let i = 0; i < messages.length; i += 50) {
      const batch = messages.slice(i, i + 50);
      const batchResults = await Promise.all(
        batch.map(msg => this.send(msg))
      );
      results.push(...batchResults);
    }

    return results;
  }
}

export const emailService = EmailService.getInstance();
