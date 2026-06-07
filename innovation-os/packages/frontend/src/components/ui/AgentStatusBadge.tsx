import { Badge } from './Badge';
import type { AgentStatus } from '@innovationos/shared';

const statusConfig: Record<
  AgentStatus,
  { label: string; variant: 'pending' | 'running' | 'success' | 'danger' }
> = {
  pending: { label: 'Pending', variant: 'pending' },
  running: { label: 'Running...', variant: 'running' },
  completed: { label: 'Complete', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status] ?? { label: status, variant: 'pending' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
