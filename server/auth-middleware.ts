import type { Request, Response, NextFunction } from "express";

export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const xInternalToken = req.headers["x-internal-token"] as string | undefined;
  
  let token: string | undefined;
  
  // Accept either Authorization: Bearer <token> OR X-INTERNAL-TOKEN: <token>
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (xInternalToken) {
    token = xInternalToken;
  }
  
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const internalToken = process.env.N8N_INTERNAL_TOKEN;

  if (!internalToken || internalToken === "__SET_AT_DEPLOY__") {
    return res.status(503).json({ error: "Internal token not configured" });
  }

  if (token !== internalToken) {
    return res.status(403).json({ error: "Invalid internal token" });
  }

  next();
}
