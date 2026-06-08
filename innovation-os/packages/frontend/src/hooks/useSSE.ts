'use client';
import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import type { AgentType, AgentStatus } from '@innovationos/shared';

interface UseSSEOptions {
  /** Called whenever a report_ready event arrives — use this to immediately fetch the report. */
  onReportReady?: () => void;
}

export function useSSE(projectId: string, options: UseSSEOptions = {}) {
  const { updateAgentStatus, setTimeRemaining, setReportReady } = useProjectStore();
  const { onReportReady } = options;

  useEffect(() => {
    if (!projectId) return;

    const es = new EventSource(`/api/sse/${projectId}`);

    es.addEventListener('agent_status', (e) => {
      try {
        const { agentType, status } = JSON.parse(e.data) as {
          agentType: AgentType;
          status: AgentStatus;
        };
        updateAgentStatus(agentType, status);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('time_remaining', (e) => {
      try {
        const { estimatedSeconds } = JSON.parse(e.data) as { estimatedSeconds: number };
        setTimeRemaining(estimatedSeconds);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('report_ready', () => {
      setReportReady(true);
      // Immediately invoke caller's fetch callback so the report loads
      // without waiting for the next polling tick.
      onReportReady?.();
    });

    es.onerror = () => {
      // Browser auto-reconnects — no action needed here
    };

    return () => es.close();
  }, [projectId, updateAgentStatus, setTimeRemaining, setReportReady, onReportReady]);
}
