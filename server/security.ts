import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * Security Utilities for High-Integrity CRM Integration
 * 
 * Supports:
 * 1. HMAC-SHA256 signature verification for inbound webhooks
 * 2. JWT verification (HS256) for internal system calls
 * 3. HMAC signature generation for outbound callbacks
 */

const INTERNAL_SECRET = process.env.AGENT_INTERNAL_TOKEN || process.env.N8N_INTERNAL_TOKEN || "__SET_AT_DEPLOY__";
const WEBHOOK_SECRET = process.env.AGENT_WEBHOOK_SECRET || "__SET_AT_DEPLOY__";

const JWT_ISSUER = "smartklix-agent-platform";
const JWT_AUDIENCE = "smartklix-crm";

/**
 * Verify a JWT token using the internal secret
 * Now enforces production rules: iss, aud, and tenant_id presence
 */
export function verifyInternalToken(token: string): boolean {
  if (!token) return false;
  
  // Legacy support: check if it's the raw static token first
  if (token === INTERNAL_SECRET) return true;
  
  try {
    // Attempt JWT verification with strict production rules
    const decoded = jwt.verify(token, INTERNAL_SECRET, { 
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as any;
    
    // Ensure tenant_id is present in claims
    return !!decoded.tenant_id;
  } catch (err) {
    return false;
  }
}

/**
 * Generate HMAC-SHA256 signature for a payload using the canonical format
 * Format: ${timestamp}.${payload_string}
 */
export function generateHmacSignature(payload: string | object, timestamp: string, secret: string = WEBHOOK_SECRET): string {
  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
  const canonicalString = `${timestamp}.${payloadString}`;
  
  return crypto
    .createHmac("sha256", secret)
    .update(canonicalString)
    .digest("hex");
}

/**
 * Verify HMAC-SHA256 signature with timestamp tolerance
 */
export function verifyHmacSignature(
  payload: string | object, 
  signature: string, 
  timestamp: string,
  secret: string = WEBHOOK_SECRET
): boolean {
  if (!signature || !timestamp) return false;

  // 1. Check timestamp tolerance (±300 seconds)
  const now = Math.floor(Date.now() / 1000);
  const receivedTimestamp = parseInt(timestamp, 10);
  if (isNaN(receivedTimestamp) || Math.abs(now - receivedTimestamp) > 300) {
    return false;
  }

  // 2. Generate and compare signature
  const expectedSignature = generateHmacSignature(payload, timestamp, secret);
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (err) {
    return false;
  }
}

