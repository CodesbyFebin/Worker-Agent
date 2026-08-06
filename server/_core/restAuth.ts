import type { RequestHandler, Response } from "express";
import type { AuthContext } from "./context";
import { createAuthContext } from "./context";
import type { PermissionKey } from "./auth/permissions";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

function send(res: Response, status: number, body: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(body);
}

export const restAuth = (): RequestHandler => async (req, res, next) => {
  try {
    req.auth = await createAuthContext(req, res);
    next();
  } catch (err) {
    next(err);
  }
};

export function requirePermission(permission: PermissionKey): RequestHandler {
  return async (req, res, next) => {
    try {
      const ctx = await createAuthContext(req, res);
      req.auth = ctx;

      if (!ctx.userId || !ctx.sessionId) {
        send(res, 401, { error: "UNAUTHENTICATED", message: "Sign in required" });
        return;
      }
      if (!ctx.organizationId) {
        send(res, 403, {
          error: "FORBIDDEN",
          message: "No active organization — select or create an organization",
        });
        return;
      }
      if (!ctx.permissions.includes(permission)) {
        send(res, 403, { error: "FORBIDDEN", message: `Missing permission: ${permission}` });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
