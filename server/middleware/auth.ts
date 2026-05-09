import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Extend express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = req.session.userId;
  next();
}

export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // requireAuth first
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = req.session.userId;
    
    const user = await storage.getUser(req.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
