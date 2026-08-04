import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceId } from "./AppShell";

export type WorkspaceNav = {
  active: WorkspaceId;
  setActive: (id: WorkspaceId) => void;
  focusScriptId: string | null;
  setFocusScriptId: (id: string | null) => void;
  focusPipelineId: string | null;
  setFocusPipelineId: (id: string | null) => void;
};

const WorkspaceNavContext = createContext<WorkspaceNav | null>(null);

export function WorkspaceNavProvider({
  value,
  children,
}: {
  value: WorkspaceNav;
  children: ReactNode;
}) {
  return <WorkspaceNavContext.Provider value={value}>{children}</WorkspaceNavContext.Provider>;
}

export function useWorkspaceNav(): WorkspaceNav {
  const ctx = useContext(WorkspaceNavContext);
  if (!ctx) {
    return {
      active: "overview",
      setActive: () => undefined,
      focusScriptId: null,
      setFocusScriptId: () => undefined,
      focusPipelineId: null,
      setFocusPipelineId: () => undefined,
    };
  }
  return ctx;
}
