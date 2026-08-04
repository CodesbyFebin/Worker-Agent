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
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  scripts: many(scripts),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  owner: one(users, { fields: [scripts.userId], references: [users.id] }),
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
}));

export const agentTasksRelations = relations(agentTasks, ({ one, many }) => ({
  script: one(scripts, { fields: [agentTasks.scriptId], references: [scripts.id] }),
  worktree: one(agentWorktrees, { fields: [agentTasks.worktreeId], references: [agentWorktrees.id] }),
  parent: one(agentTasks, { fields: [agentTasks.parentTaskId], references: [agentTasks.id] }),
  children: many(agentTasks),
}));

export const agentWorktreesRelations = relations(agentWorktrees, ({ many }) => ({
  tasks: many(agentTasks),
}));

export const contentCampaignsRelations = relations(contentCampaigns, ({ one, many }) => ({
  owner: one(users, { fields: [contentCampaigns.userId], references: [users.id] }),
  tasks: many(agentTasks),
}));
