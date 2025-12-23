/**
 * Isolation Middleware for Absolute Multi-Tenant Security
 * Ensures users can only access data from their own organization
 */

import type { RequestHandler } from "express";
import { storage } from "./storage";

/**
 * Middleware to verify that any organizationId in request body/params/query
 * matches the authenticated user's organizationId
 * This prevents users from accessing other organizations' data
 */
export const verifyOrganizationIsolation: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Store user's organizationId in request for easy access
    req.userOrganizationId = user.organizationId;

    // Check if request contains organizationId that doesn't match user's organization
    const checkOrganizationId = (orgId: string | undefined, source: string) => {
      if (orgId && orgId !== user.organizationId) {
        console.warn(`[Isolation] Blocked attempt to access organization ${orgId} (user's org: ${user.organizationId}) from ${source}`);
        return false;
      }
      return true;
    };

    // Check request body
    if (req.body?.organizationId) {
      if (!checkOrganizationId(req.body.organizationId, "body")) {
        return res.status(403).json({ 
          message: "Forbidden: Cannot access other organization's data",
          error: "Organization ID mismatch"
        });
      }
    }

    // Check query parameters
    if (req.query?.organizationId) {
      if (!checkOrganizationId(req.query.organizationId as string, "query")) {
        return res.status(403).json({ 
          message: "Forbidden: Cannot access other organization's data",
          error: "Organization ID mismatch"
        });
      }
    }

    // Check route parameters
    if (req.params?.organizationId) {
      if (!checkOrganizationId(req.params.organizationId, "params")) {
        return res.status(403).json({ 
          message: "Forbidden: Cannot access other organization's data",
          error: "Organization ID mismatch"
        });
      }
    }

    next();
  } catch (error) {
    console.error("[Isolation] Error in isolation middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Helper to ensure organizationId is set from user context
 * Use this in routes to automatically set organizationId from authenticated user
 */
export function ensureUserOrganization(req: any): string {
  const orgId = req.userOrganizationId || req.user?.organizationId;
  if (!orgId) {
    throw new Error("User organization ID not found");
  }
  return orgId;
}




