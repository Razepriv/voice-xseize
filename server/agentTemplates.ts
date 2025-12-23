import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { agentTemplates } from "@shared/schema";

export async function getAgentTemplatesForUser(userId: string) {
  return await db.select().from(agentTemplates).where(eq(agentTemplates.createdBy, userId)).orderBy(desc(agentTemplates.updatedAt));
}

export async function createAgentTemplate(template: any) {
  const [created] = await db.insert(agentTemplates).values(template).returning();
  return created;
}

export async function updateAgentTemplate(id: string, userId: string, template: any) {
  const [updated] = await db.update(agentTemplates)
    .set({ ...template, updatedAt: new Date() })
    .where(and(eq(agentTemplates.id, id), eq(agentTemplates.createdBy, userId)))
    .returning();
  return updated;
}

export async function deleteAgentTemplate(id: string, userId: string) {
  const result = await db.delete(agentTemplates)
    .where(and(eq(agentTemplates.id, id), eq(agentTemplates.createdBy, userId)))
    .returning();
  return result.length > 0;
}
