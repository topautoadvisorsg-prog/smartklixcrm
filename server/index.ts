/**
 * Smart Klix CRM - Server Entry Point
 * 
 * Initializes Express application, middleware, and routes.
 * Sets up session management, Stripe integration, and outbox worker.
 * 
 * Architecture: CRM Brain + External Agent Execution (Webhook-Based)
 */

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { pool } from "./db";
import { startOutboxWorker } from "./outbox-worker";
import { initCache, closeCache } from "./cache";
import { storage } from "./storage";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'Managed webhook for Smart Klix CRM Stripe sync',
      }
    );
    log(`Stripe webhook configured: ${webhook.url} (UUID: ${uuid})`);

    stripeSync.syncBackfill()
      .then(() => log('Stripe data synced'))
      .catch((err: any) => log(`Error syncing Stripe data: ${err.message}`));
  } catch (error: any) {
    log(`Stripe initialization warning: ${error.message}`);
  }
}

initStripe();

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Session middleware - use memory store for development/testing
// (Switch to connect-pg-simple in production with DATABASE_URL)
const isDatabaseAvailable = pool !== null;

if (isDatabaseAvailable) {
  const PgSession = connectPgSimple(session);
  app.use(session({
    store: new PgSession({ 
      pool: pool as any, 
      tableName: "session" 
    }),
    secret: process.env.SESSION_SECRET || "smartklix-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  log("✅ Session store: PostgreSQL");
} else {
  // Use default memory store for development/testing
  app.use(session({
    secret: process.env.SESSION_SECRET || "smartklix-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  log("⚠️ Session store: Memory (development mode - sessions lost on restart)");
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize cache
  await initCache();

  const server = await registerRoutes(app);

  // NOTE: Export routes are already mounted in routes.ts (line 546) BEFORE the auth wall
  // Do NOT mount them here to avoid duplicate registration

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ success: false, error: message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, async () => {
    log(`serving on port ${port}`);
    
    // Create default admin user if not exists (for testing)
    try {
      const existingAdmin = await storage.getUserByUsername("admin");
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await storage.createUser({
          username: "admin",
          password: hashedPassword,
          email: "admin@smartklix.com",
          role: "admin",
        });
        log("✅ Admin user created: admin / admin123");
      }
    } catch (error: any) {
      log(`⚠️ Could not create admin user: ${error.message}`);
    }
    
    // Start the event outbox worker for reliable external dispatch
    startOutboxWorker();
    log("Event outbox worker started");
  });
})();
