'use client';
import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import type { AgentType, AgentStatus } from '@innovationos/shared';

export function useSSE(projectId: string) {
  const { updateAgentStatus, setTimeRemaining, setReportReady } = useProjectStore();

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
    });

    es.onerror = () => {
      // Browser will auto-reconnect on its own
    };

    return () => es.close();
  }, [projectId, updateAgentStatus, setTimeRemaining, setReportReady]);
}
