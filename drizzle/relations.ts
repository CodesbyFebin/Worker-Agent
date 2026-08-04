import { relations } from "drizzle-orm";
import {
  scripts,
  scriptSections,
  generatedMetadata,
  claimLedger,
  users,
  agentTasks,
  agentWorktrees,
  contentCampaigns,
  organizations,
  organizationMembers,
  roles,
  sessions,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  scripts: many(scripts),
  memberships: many(organizationMembers),
  sessions: many(sessions),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  sessions: many(sessions),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
  role: one(roles, { fields: [organizationMembers.roleId], references: [roles.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [sessions.organizationId],
    references: [organizations.id],
  }),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  owner: one(users, { fields: [scripts.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [scripts.organizationId],
    references: [organizations.id],
  }),
  sections: many(scriptSections),
  metadata: many(generatedMetadata),
  claims: many(claimLedger),
}));

export const scriptSectionsRelations = relations(scriptSections, ({ one }) => ({
  script: one(scripts, { fields: [scriptSections.scriptId], references: [scripts.id] }),
}));

export const generatedMetadataRelations = relations(generatedMetadata, ({ one }) => ({
  script: one(scripts, { fields: [generatedMetadata.scriptId], references: [scripts.id] }),
}));

export const claimLedgerRelations = relations(claimLedger, ({ one }) => ({
  script: one(scripts, { fields: [claimLedger.scriptId], references: [scripts.id] }),
  organization: one(organizations, {
    fields: [claimLedger.organizationId],
    references: [organizations.id],
  }),
}));

export const agentTasksRelations = relations(agentTasks, ({ one, many }) => ({
  script: one(scripts, { fields: [agentTasks.scriptId], references: [scripts.id] }),
  worktree: one(agentWorktrees, { fields: [agentTasks.worktreeId], references: [agentWorktrees.id] }),
  parent: one(agentTasks, { fields: [agentTasks.parentTaskId], references: [agentTasks.id] }),
  children: many(agentTasks),
  organization: one(organizations, {
    fields: [agentTasks.organizationId],
    references: [organizations.id],
  }),
}));

export const agentWorktreesRelations = relations(agentWorktrees, ({ many }) => ({
  tasks: many(agentTasks),
}));

export const contentCampaignsRelations = relations(contentCampaigns, ({ one, many }) => ({
  owner: one(users, { fields: [contentCampaigns.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [contentCampaigns.organizationId],
    references: [organizations.id],
  }),
  tasks: many(agentTasks),
}));
