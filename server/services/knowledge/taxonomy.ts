import { and, eq } from "drizzle-orm";
import { db } from "../../_core/db";
import { topicTaxonomies } from "../../../drizzle/schema";

export type TaxonomyNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  properties: string | null;
  children: TaxonomyNode[];
  createdAt: string;
  updatedAt: string;
};

export async function createTopic(params: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  properties?: Record<string, unknown>;
  createdBy: string;
}): Promise<TaxonomyNode> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(topicTaxonomies).values({
    id,
    organizationId: params.organizationId,
    name: params.name,
    slug: params.slug,
    description: params.description ?? null,
    parentId: params.parentId ?? null,
    properties: params.properties ? JSON.stringify(params.properties) : null,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db.select().from(topicTaxonomies).where(eq(topicTaxonomies.id, id)).limit(1);
  if (!row) throw new Error("Failed to load topic after insert");
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parentId,
    properties: row.properties,
    children: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getTopicTree(organizationId: string) {
  const rows = await db.select().from(topicTaxonomies).where(eq(topicTaxonomies.organizationId, organizationId));
  const byId = new Map<string, TaxonomyNode>();
  const roots: TaxonomyNode[] = [];
  for (const r of rows) {
    const node: TaxonomyNode = {
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      children: [],
    };
    byId.set(node.id, node);
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function updateTopic(params: {
  organizationId: string;
  topicId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  properties?: Record<string, unknown>;
}): Promise<TaxonomyNode | null> {
  const [existing] = await db
    .select()
    .from(topicTaxonomies)
    .where(and(eq(topicTaxonomies.id, params.topicId), eq(topicTaxonomies.organizationId, params.organizationId)))
    .limit(1);
  if (!existing) return null;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined) updateData.name = params.name;
  if (params.slug !== undefined) updateData.slug = params.slug;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.properties !== undefined) updateData.properties = JSON.stringify(params.properties);

  await db.update(topicTaxonomies).set(updateData).where(eq(topicTaxonomies.id, params.topicId));
  const [updated] = await db.select().from(topicTaxonomies).where(eq(topicTaxonomies.id, params.topicId)).limit(1);
  if (!updated) return null;
  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    parentId: updated.parentId,
    properties: updated.properties,
    children: [],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteTopic(organizationId: string, topicId: string): Promise<boolean> {
  const result = await db
    .delete(topicTaxonomies)
    .where(and(eq(topicTaxonomies.id, topicId), eq(topicTaxonomies.organizationId, organizationId)));
  return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0) > 0;
}
