/**
 * Webhook Signature Verification Module
 * 
 * This module provides HMAC-SHA256 signature verification for incoming webhooks
 * from external services like n8n, Twilio, and other automation platforms.
 * 
 * Usage:
 *   import { verifyWebhookSignature, webhookVerificationMiddleware } from './webhook-verification';
 *   
 *   // As middleware:
 *   app.post('/webhook', webhookVerificationMiddleware('N8N_WEBHOOK_SECRET'), handler);
 *   
 *   // Manual verification:
 *   const isValid = verifyWebhookSignature(payload, signature, secret);
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: Date;
}

/**
 * Verify an HMAC-SHA256 signature against a payload
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): WebhookVerificationResult {
  if (!signature) {
    return { valid: false, error: "Missing signature header" };
  }

  if (!secret) {
    return { valid: false, error: "Webhook secret not configured" };
  }

  try {
    const payloadString = typeof payload === "string" ? payload : payload.toString("utf8");
    
    const expectedSignature = createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Invalid signature length" };
    }

    const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);
    
    return { 
      valid: isValid, 
      error: isValid ? undefined : "Signature mismatch",
      timestamp: new Date(),
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : "Verification failed" 
    };
  }
}

/**
 * Log a webhook verification failure for monitoring
 */
async function logVerificationFailure(
  endpoint: string,
  ipAddress: string,
  error: string,
  headers: Record<string, string | string[] | undefined>
): Promise<void> {
  try {
    await storage.createAuditLogEntry({
      userId: null,
      action: "webhook_signature_failure",
      entityType: "security",
      entityId: endpoint,
      details: {
        ipAddress,
        error,
        endpoint,
        timestamp: new Date().toISOString(),
        userAgent: headers["user-agent"],
        signatureHeader: headers["x-webhook-signature"] || headers["x-hub-signature-256"],
      },
    });
  } catch (logError) {
    console.error("[Webhook Security] Failed to log verification failure:", logError);
  }
}

/**
 * Express middleware for webhook signature verification
 * 
 * @param secretEnvVar - Environment variable name containing the webhook secret
 * @param signatureHeader - Header name containing the signature (default: x-webhook-signature)
 * @param optional - If true, allow requests without signatures (for backward compatibility)
 */
export function webhookVerificationMiddleware(
  secretEnvVar: string,
  signatureHeader: string = "x-webhook-signature",
  optional: boolean = false
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env[secretEnvVar];
    const signature = req.headers[signatureHeader.toLowerCase()] as string | undefined;
    const endpoint = req.originalUrl || req.url;
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

    if (!signature && optional) {
      console.warn(`[Webhook] No signature provided for ${endpoint} (optional mode)`);
      return next();
    }

    if (!secret) {
      if (optional) {
        console.warn(`[Webhook] Secret ${secretEnvVar} not configured (optional mode)`);
        return next();
      }
      
      await logVerificationFailure(endpoint, ipAddress, "Secret not configured", req.headers as Record<string, string | string[] | undefined>);
      return res.status(500).json({ 
        error: "Webhook verification not configured",
        code: "WEBHOOK_SECRET_MISSING",
      });
    }

    if (!signature) {
      await logVerificationFailure(endpoint, ipAddress, "Missing signature", req.headers as Record<string, string | string[] | undefined>);
      return res.status(401).json({ 
        error: "Missing webhook signature",
        code: "SIGNATURE_MISSING",
      });
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const payload = rawBody || JSON.stringify(req.body);
    
    const result = verifyWebhookSignature(payload, signature, secret);

    if (!result.valid) {
      await logVerificationFailure(endpoint, ipAddress, result.error || "Unknown error", req.headers as Record<string, string | string[] | undefined>);
      console.error(`[Webhook Security] Signature verification failed for ${endpoint}: ${result.error}`);
      
      return res.status(401).json({ 
        error: "Invalid webhook signature",
        code: "SIGNATURE_INVALID",
      });
    }

    (req as Request & { webhookVerified: boolean }).webhookVerified = true;
    next();
  };
}

/**
 * Create a signature for outgoing webhooks
 */
export function createWebhookSignature(payload: string | object, secret: string): string {
  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `sha256=${createHmac("sha256", secret).update(payloadString).digest("hex")}`;
}

/**
 * Get a list of all webhook signature failures from audit log
 */
export async function getWebhookSecurityLog(
  limit: number = 50
): Promise<Array<{
  timestamp: Date;
  endpoint: string;
  ipAddress: string;
  error: string;
}>> {
  const auditLogs = await storage.getAuditLog();
  
  return auditLogs
    .filter((log) => log.action === "webhook_signature_failure")
    .slice(0, limit)
    .map((log) => ({
      timestamp: log.timestamp,
      endpoint: log.entityId || "unknown",
      ipAddress: (log.details as Record<string, unknown>)?.ipAddress as string || "unknown",
      error: (log.details as Record<string, unknown>)?.error as string || "unknown",
    }));
}
