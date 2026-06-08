import { create } from 'zustand';
import type { AgentType, AgentStatus } from '@innovationos/shared';

interface ProjectStore {
  currentProjectId: string | null;
  agentStatuses: Partial<Record<AgentType, AgentStatus>>;
  timeRemaining: number | null;
  reportReady: boolean;
  updateAgentStatus: (agentType: AgentType, status: AgentStatus) => void;
  setTimeRemaining: (seconds: number | null) => void;
  setReportReady: (ready: boolean) => void;
  /** Call this whenever the active project changes. Resets all live state. */
  initProject: (projectId: string) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProjectId: null,
  agentStatuses: {},
  timeRemaining: null,
  reportReady: false,

  updateAgentStatus: (agentType, status) =>
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [agentType]: status },
    })),

  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),

  setReportReady: (ready) => set({ reportReady: ready }),

  /**
   * Switch to a new project. If the projectId differs from the current one,
   * all live state (statuses, reportReady, timeRemaining) is reset to avoid
   * stale data from a previously viewed project bleeding into the new view.
   */
  initProject: (projectId: string) => {
    if (get().currentProjectId !== projectId) {
      set({
        currentProjectId: projectId,
        agentStatuses: {},
        timeRemaining: null,
        reportReady: false,
      });
    }
  },

  reset: () =>
    set({
      currentProjectId: null,
      agentStatuses: {},
      timeRemaining: null,
      reportReady: false,
    }),
}));
