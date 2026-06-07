import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface AgentStatuses {
  validation?: string;
  competitor?: string;
  roadmap?: string;
  feasibility?: string;
  [key: string]: string | undefined;
}

interface ProjectSummary {
  id: string;
  title: string;
  industry: string;
  createdAt: string;
  agentStatuses: AgentStatuses;
}

async function getProjects(): Promise<ProjectSummary[]> {
  try {
    const res = await fetch('http://localhost:3001/api/projects', {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

function AgentSummary({ statuses }: { statuses: AgentStatuses }) {
  const agents = ['validation', 'competitor', 'roadmap', 'feasibility'];
  const completed = agents.filter((a) => statuses[a] === 'completed').length;
  const failed = agents.filter((a) => statuses[a] === 'failed').length;
  const running = agents.filter((a) => statuses[a] === 'running').length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">
        {completed}/{agents.length} agents complete
      </span>
      {running > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Running
        </span>
      )}
      {failed > 0 && (
        <span className="text-xs text-red-400">{failed} failed</span>
      )}
    </div>
  );
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Project
        </a>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border rounded-2xl">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No projects yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Submit your first idea and let the AI agents get to work.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start New Project
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/projects/${project.id}`}
              className="group block bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {project.title}
                    </h2>
                    <Badge variant="info">{project.industry}</Badge>
                  </div>
                  <AgentSummary statuses={project.agentStatuses} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(project.createdAt)}
                  </p>
                  <svg
                    className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-2 ml-auto transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>

              {/* Agent status dots */}
              <div className="mt-4 flex items-center gap-2">
                {(['validation', 'competitor', 'roadmap', 'feasibility'] as const).map((agent) => {
                  const status = project.agentStatuses[agent] ?? 'pending';
                  const dotClass =
                    status === 'completed'
                      ? 'bg-green-500'
                      : status === 'running'
                      ? 'bg-blue-400 animate-pulse'
                      : status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-zinc-600';
                  return (
                    <div key={agent} className="flex items-center gap-1" title={`${agent}: ${status}`}>
                      <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                      <span className="text-xs text-muted-foreground capitalize hidden sm:block">
                        {agent}
                      </span>
                    </div>
                  );
                })}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
