import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  agentEvents,
  agentTasks,
  claimLedger,
  contentCampaigns,
  contentOpsPipelines,
  organizationMembers,
  organizations,
  permissions,
  rolePermissions,
  roles,
  scripts,
  users,
} from "../../../drizzle/schema";
import { PERMISSIONS, ROLE_PERMISSION_MAP } from "./permissions";

let bootstrapped = false;

const SYSTEM_ROLE_IDS: Record<keyof typeof ROLE_PERMISSION_MAP, string> = {
  owner: "role-system-owner",
  admin: "role-system-admin",
  member: "role-system-member",
  viewer: "role-system-viewer",
};

export async function ensureSystemRoles(): Promise<void> {
  for (const key of PERMISSIONS) {
    const [existing] = await db.select().from(permissions).where(eq(permissions.key, key)).limit(1);
    if (!existing) {
      await db.insert(permissions).values({
        id: randomUUID(),
        key,
        description: key,
        createdAt: new Date(),
      });
    }
  }

  for (const [slug, roleId] of Object.entries(SYSTEM_ROLE_IDS) as Array<
    [keyof typeof ROLE_PERMISSION_MAP, string]
  >) {
    const [existing] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!existing) {
      await db.insert(roles).values({
        id: roleId,
        organizationId: null,
        slug,
        name: slug.charAt(0).toUpperCase() + slug.slice(1),
        createdAt: new Date(),
      });
    }

    const permKeys = ROLE_PERMISSION_MAP[slug];
    for (const key of permKeys) {
      const [perm] = await db.select().from(permissions).where(eq(permissions.key, key)).limit(1);
      if (!perm) continue;
      const [link] = await db
        .select()
        .from(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, perm.id)))
        .limit(1);
      if (!link) {
        await db.insert(rolePermissions).values({ roleId, permissionId: perm.id });
      }
    }
  }
}

export async function getSystemRoleId(slug: keyof typeof ROLE_PERMISSION_MAP): Promise<string> {
  await ensureSystemRoles();
  return SYSTEM_ROLE_IDS[slug];
}

export async function loadPermissionsForRole(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.key);
}

/**
 * Seeds RBAC rows and backfills organizationId on legacy domain rows.
 * Safe to call on every API boot (idempotent).
 */
export async function ensureAuthBootstrap(): Promise<void> {
  if (bootstrapped) return;
  await ensureSystemRoles();
  await backfillOrganizationScope();
  bootstrapped = true;
}

async function ensureOrgForUser(userId: string, email: string): Promise<string> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  if (member) return member.organizationId;

  const organizationId = randomUUID();
  const slug = `user-${userId.slice(0, 8)}`;
  await db.insert(organizations).values({
    id: organizationId,
    name: `${email.split("@")[0] ?? "User"} workspace`,
    slug,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organizationMembers).values({
    id: randomUUID(),
    organizationId,
    userId,
    roleId: SYSTEM_ROLE_IDS.owner,
    createdAt: new Date(),
  });
  return organizationId;
}

async function backfillOrganizationScope(): Promise<void> {
  const allUsers = await db.select().from(users);
  const userOrg = new Map<string, string>();
  for (const u of allUsers) {
    userOrg.set(u.id, await ensureOrgForUser(u.id, u.email));
  }

  // Legacy rows without organizationId — attach to owner's personal org.
  const orphanScripts = await db.select().from(scripts).where(isNull(scripts.organizationId));
  for (const row of orphanScripts) {
    const orgId = userOrg.get(row.userId) ?? (await ensureOrgForUser(row.userId, `${row.userId}@local.dev`));
    await db.update(scripts).set({ organizationId: orgId }).where(eq(scripts.id, row.id));
  }

  const orphanCampaigns = await db.select().from(contentCampaigns).where(isNull(contentCampaigns.organizationId));
  for (const row of orphanCampaigns) {
    const orgId = userOrg.get(row.userId) ?? (await ensureOrgForUser(row.userId, `${row.userId}@local.dev`));
    await db.update(contentCampaigns).set({ organizationId: orgId }).where(eq(contentCampaigns.id, row.id));
  }

  const orphanPipelines = await db
    .select()
    .from(contentOpsPipelines)
    .where(isNull(contentOpsPipelines.organizationId));
  for (const row of orphanPipelines) {
    const orgId = userOrg.get(row.userId) ?? (await ensureOrgForUser(row.userId, `${row.userId}@local.dev`));
    await db.update(contentOpsPipelines).set({ organizationId: orgId }).where(eq(contentOpsPipelines.id, row.id));
  }

  const orphanClaims = await db.select().from(claimLedger).where(isNull(claimLedger.organizationId));
  for (const row of orphanClaims) {
    if (!row.scriptId) continue;
    const [script] = await db.select().from(scripts).where(eq(scripts.id, row.scriptId)).limit(1);
    if (!script?.organizationId) continue;
    await db.update(claimLedger).set({ organizationId: script.organizationId }).where(eq(claimLedger.id, row.id));
  }

  const orphanTasks = await db.select().from(agentTasks).where(isNull(agentTasks.organizationId));
  for (const row of orphanTasks) {
    let orgId: string | null = null;
    if (row.scriptId) {
      const [script] = await db.select().from(scripts).where(eq(scripts.id, row.scriptId)).limit(1);
      orgId = script?.organizationId ?? null;
    }
    if (!orgId && row.campaignId) {
      const [campaign] = await db
        .select()
        .from(contentCampaigns)
        .where(eq(contentCampaigns.id, row.campaignId))
        .limit(1);
      orgId = campaign?.organizationId ?? null;
    }
    if (!orgId && allUsers[0]) {
      orgId = userOrg.get(allUsers[0].id) ?? null;
    }
    if (orgId) {
      await db.update(agentTasks).set({ organizationId: orgId }).where(eq(agentTasks.id, row.id));
    }
  }

  const orphanEvents = await db.select().from(agentEvents).where(isNull(agentEvents.organizationId));
  for (const row of orphanEvents) {
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, row.taskId)).limit(1);
    if (task?.organizationId) {
      await db
        .update(agentEvents)
        .set({ organizationId: task.organizationId })
        .where(eq(agentEvents.id, row.id));
    }
  }
}
