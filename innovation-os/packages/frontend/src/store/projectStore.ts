import { create } from 'zustand';
import type { AgentType, AgentStatus } from '@innovationos/shared';

interface ProjectStore {
  agentStatuses: Partial<Record<AgentType, AgentStatus>>;
  timeRemaining: number | null;
  reportReady: boolean;
  updateAgentStatus: (agentType: AgentType, status: AgentStatus) => void;
  setTimeRemaining: (seconds: number | null) => void;
  setReportReady: (ready: boolean) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  agentStatuses: {},
  timeRemaining: null,
  reportReady: false,
  updateAgentStatus: (agentType, status) =>
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [agentType]: status },
    })),
  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),
  setReportReady: (ready) => set({ reportReady: ready }),
  reset: () => set({ agentStatuses: {}, timeRemaining: null, reportReady: false }),
}));
