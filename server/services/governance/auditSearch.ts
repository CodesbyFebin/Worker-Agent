import { and, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { db } from "../../_core/db";
import { auditLogs, organizations, users } from "../../../drizzle/schema";

export type AuditLogFilter = {
  organizationId?: string;
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  search?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  cursor?: string | null;
};

export type AuditLogRow = {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  payload: string | null;
  createdAt: string;
};

export type AuditPagination = {
  nextCursor: string | null;
  hasMore: boolean;
  items: AuditLogRow[];
};

export async function searchAuditLogs(filter: AuditLogFilter): Promise<AuditPagination> {
  const limit = Math.min(filter.limit ?? 50, 200);
  const cursor = filter.cursor ?? null;

  const conditions: (ReturnType<typeof eq> | ReturnType<typeof gte>)[] = [];
  if (filter.organizationId) conditions.push(eq(auditLogs.organizationId, filter.organizationId));
  if (filter.actorUserId) conditions.push(eq(auditLogs.actorUserId, filter.actorUserId));
  if (filter.action) conditions.push(eq(auditLogs.action, filter.action));
  if (filter.resourceType) conditions.push(eq(auditLogs.resourceType, filter.resourceType));
  if (filter.resourceId) conditions.push(eq(auditLogs.resourceId, filter.resourceId));
  if (filter.since) conditions.push(gte(auditLogs.createdAt, filter.since));
  if (filter.until) conditions.push(sql`${auditLogs.createdAt} <= ${filter.until}`);

  if (filter.search) {
    const term = `%${filter.search.replace(/%/g, "\\%")}%`;
    conditions.push(
      or(
        like(auditLogs.action, term),
        like(auditLogs.resourceType, term),
        like(auditLogs.resourceId, term),
        like(auditLogs.payload, term),
      ),
    );
  }

  const whereClause = conditions.length === 0 ? undefined : and(...conditions);

  let baseQuery = db.select().from(auditLogs);
  if (whereClause) baseQuery = baseQuery.where(whereClause) as typeof baseQuery;

  const rows = await baseQuery
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit + 1);

  let items = rows as AuditLogRow[];
  let nextCursor: string | null = null;
  if (items.length > limit) {
    items = items.slice(0, limit);
    nextCursor = items[items.length - 1]!.id;
  }

  const actorIds = Array.from(new Set(items.filter((r) => r.actorUserId).map((r) => r.actorUserId!))).filter(
    Boolean,
  ) as string[];
  const orgIds = Array.from(new Set(items.filter((r) => r.organizationId).map((r) => r.organizationId!))).filter(
    Boolean,
  ) as string[];

  const [actorMap, orgMap] = await Promise.all([
    actorIds.length
      ? db.select({ id: users.id, email: users.email, displayName: users.displayName }).from(users).where(
          or(...actorIds.map((id) => eq(users.id, id))),
        )
      : Promise.resolve([]),
    orgIds.length
      ? db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(
          or(...orgIds.map((id) => eq(organizations.id, id))),
        )
      : Promise.resolve([]),
  ]);

  const userById = new Map(actorMap.map((u) => [u.id, u]));
  const orgById = new Map(orgMap.map((o) => [o.id, o]));

  const enriched = items.map((row) => {
    const actor = row.actorUserId ? userById.get(row.actorUserId) : null;
    const org = row.organizationId ? orgById.get(row.organizationId) : null;
    return {
      ...row,
      actorEmail: actor?.email ?? null,
      actorName: actor?.displayName ?? null,
      organizationName: org?.name ?? null,
    };
  });

  return { items: enriched, nextCursor, hasMore: rows.length > limit };
}

export async function getAuditLogStats(organizationId: string, since: Date) {
  const actionCounts = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.organizationId, organizationId), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.action)
    .orderBy(sql`count(*) desc`);

  const actorCounts = await db
    .select({
      actorUserId: auditLogs.actorUserId,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.organizationId, organizationId), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.actorUserId)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  const total = await db
    .select({ total: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(eq(auditLogs.organizationId, organizationId), gte(auditLogs.createdAt, since)));

  return {
    total: Number(total[0]?.total ?? 0),
    actionCounts: actionCounts.map((r) => ({ action: r.action, count: Number(r.count) })),
    actorCounts: actorCounts.map((r) => ({ actorUserId: r.actorUserId, count: Number(r.count) })),
  };
}
