/**
 * Mock Agent Gateway
 * 
 * Simulates external agent behavior for testing:
 * - Accepts proposal dispatch
 * - Logs all payloads
 * - Simulates success, failure, and timeout scenarios
 * - Sends callback to /api/agent/callback
 * 
 * Usage:
 * npm run mock-gateway
 */

import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const PORT = 8787;
const CRM_CALLBACK_URL = process.env.CRM_CALLBACK_URL || "http://localhost:5000/api/agent/callback";

// ========================================
// SIMULATION MODES
// ========================================

let simulationMode: "success" | "failure" | "timeout" | "random" = "success";

app.post("/api/simulation/mode", (req, res) => {
  const { mode } = req.body;
  if (["success", "failure", "timeout", "random"].includes(mode)) {
    simulationMode = mode as any;
    console.log(`[Mock Gateway] Simulation mode set to: ${mode}`);
    res.json({ success: true, mode });
  } else {
    res.status(400).json({ error: "Invalid mode. Use: success, failure, timeout, random" });
  }
});

app.get("/api/simulation/mode", (req, res) => {
  res.json({ mode: simulationMode });
});

// ========================================
// REQUEST LOGGING
// ========================================

const requestLog: any[] = [];

app.get("/api/logs", (req, res) => {
  res.json({
    total: requestLog.length,
    logs: requestLog.slice(-50), // Last 50 requests
  });
});

app.delete("/api/logs", (req, res) => {
  requestLog.length = 0;
  res.json({ success: true, message: "Logs cleared" });
});

// ========================================
// DISPATCH ENDPOINTS
// ========================================

function simulateBehavior(): "success" | "failure" | "timeout" {
  switch (simulationMode) {
    case "success":
      return "success";
    case "failure":
      return "failure";
    case "timeout":
      return "timeout";
    case "random":
      const rand = Math.random();
      if (rand < 0.6) return "success";
      if (rand < 0.9) return "failure";
      return "timeout";
    default:
      return "success";
  }
}

function sendCallback(payload: {
  proposalId: string;
  status: "completed" | "failed";
  result?: any;
  errorMessage?: string;
  correlationId?: string;
}): void {
  setTimeout(async () => {
    try {
      console.log(`[Mock Gateway] Sending callback to CRM:`, {
        proposalId: payload.proposalId,
        status: payload.status,
      });

      const response = await fetch(CRM_CALLBACK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": process.env.AGENT_WEBHOOK_SECRET || "",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`[Mock Gateway] Callback failed: ${response.status}`);
      } else {
        console.log(`[Mock Gateway] Callback sent successfully`);
      }
    } catch (error) {
      console.error(`[Mock Gateway] Callback error:`, error);
    }
  }, 1000); // 1 second delay to simulate async processing
}

// Task dispatch (proposals)
app.post("/execute/task", async (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[Mock Gateway] Received task dispatch:`, {
    proposalId: payload.proposalId,
    correlationId: payload.correlationId,
    summary: payload.summary,
    actions: payload.actions?.length,
  });

  // Log request
  requestLog.push({
    id: crypto.randomUUID(),
    type: "task",
    timestamp,
    payload,
  });

  const behavior = simulateBehavior();

  if (behavior === "timeout") {
    console.log(`[Mock Gateway] Simulating timeout...`);
    return res.status(504).json({ error: "Gateway timeout (simulated)" });
  }

  if (behavior === "failure") {
    console.log(`[Mock Gateway] Simulating failure...`);
    
    // Send failure callback
    sendCallback({
      proposalId: payload.proposalId,
      status: "failed",
      errorMessage: "Simulated execution failure: External service unavailable",
      correlationId: payload.correlationId,
    });

    return res.status(200).json({
      received: true,
      status: "processing",
      note: "Will send failure callback",
    });
  }

  // Success
  console.log(`[Mock Gateway] Simulating success...`);
  
  // Send success callback
  sendCallback({
    proposalId: payload.proposalId,
    status: "completed",
    result: {
      success: true,
      executedAt: new Date().toISOString(),
      actionsCompleted: payload.actions?.length || 0,
    },
    correlationId: payload.correlationId,
  });

  res.json({
    received: true,
    status: "processing",
    note: "Will send success callback",
  });
});

// Email dispatch
app.post("/execute/email", async (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[Mock Gateway] Received email dispatch:`, {
    to: payload.to,
    subject: payload.subject,
    correlationId: payload.correlationId,
  });

  requestLog.push({
    id: crypto.randomUUID(),
    type: "email",
    timestamp,
    payload,
  });

  const behavior = simulateBehavior();

  if (behavior === "timeout") {
    return res.status(504).json({ error: "Gateway timeout (simulated)" });
  }

  if (behavior === "failure") {
    return res.status(500).json({ error: "Email dispatch failed (simulated)" });
  }

  res.json({
    success: true,
    messageId: `mock-email-${crypto.randomUUID()}`,
    note: "Email sent (simulated)",
  });
});

// WhatsApp dispatch
app.post("/execute/whatsapp", async (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[Mock Gateway] Received WhatsApp dispatch:`, {
    clientId: payload.clientId,
    conversationId: payload.conversationId,
    correlationId: payload.correlationId,
  });

  requestLog.push({
    id: crypto.randomUUID(),
    type: "whatsapp",
    timestamp,
    payload,
  });

  const behavior = simulateBehavior();

  if (behavior === "timeout") {
    return res.status(504).json({ error: "Gateway timeout (simulated)" });
  }

  if (behavior === "failure") {
    return res.status(500).json({ error: "WhatsApp dispatch failed (simulated)" });
  }

  res.json({
    success: true,
    messageId: `mock-whatsapp-${crypto.randomUUID()}`,
    note: "WhatsApp message sent (simulated)",
  });
});

// Payment dispatch
app.post("/execute/payment", async (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[Mock Gateway] Received payment dispatch:`, {
    contactId: payload.contactId,
    amount: payload.amount,
    currency: payload.currency,
    correlationId: payload.correlationId,
  });

  requestLog.push({
    id: crypto.randomUUID(),
    type: "payment",
    timestamp,
    payload,
  });

  const behavior = simulateBehavior();

  if (behavior === "timeout") {
    return res.status(504).json({ error: "Gateway timeout (simulated)" });
  }

  if (behavior === "failure") {
    return res.status(500).json({ error: "Payment dispatch failed (simulated)" });
  }

  res.json({
    success: true,
    paymentLink: `https://mock.payment.link/${crypto.randomUUID()}`,
    note: "Payment link created (simulated)",
  });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get("/health", (req, res) => {
  res.json({
    status: "operational",
    simulationMode,
    totalRequests: requestLog.length,
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           MOCK AGENT GATEWAY STARTED                     ║
║                                                          ║
║  URL: http://localhost:${PORT}                            ║
║  Simulation Mode: ${simulationMode.padEnd(22)}║
║  Callback URL: ${CRM_CALLBACK_URL.padEnd(33)}║
║                                                          ║
║  Endpoints:                                              ║
║  POST /execute/task     - Proposal dispatch              ║
║  POST /execute/email    - Email dispatch                 ║
║  POST /execute/whatsapp - WhatsApp dispatch              ║
║  POST /execute/payment  - Payment dispatch               ║
║  POST /api/simulation/mode - Change simulation mode     ║
║  GET  /api/logs         - View request logs              ║
║  GET  /health           - Health check                   ║
╚══════════════════════════════════════════════════════════╝
  `);
});
