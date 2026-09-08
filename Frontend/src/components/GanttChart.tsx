interface GanttTask {
  id: string;
  title: string;
  assignee: {
    initials: string;
    name: string;
    color: string;
  };
  status: 'En cours' | 'Terminé' | 'En attente' | 'Bloqué';
  startDay: number;
  duration: number;
  startDate?: string | null;
  endDate?: string | null;
  backgroundColor: string;
  borderColor: string;
  isOverdue?: boolean;
}

interface GanttChartProps {
  tasks: GanttTask[];
  cellWidth: number;
  days?: string[];
  onTaskClick?: (taskId: string) => void;
}

function getStatusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('cours')) {
    return 'dash-status-badge bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20';
  }
  if (normalized.includes('term') || normalized.includes('fin')) {
    return 'dash-status-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
  }
  if (normalized.includes('bloq')) {
    return 'dash-status-badge bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20';
  }
  return 'dash-status-badge bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
}

export type { GanttTask };

export default function GanttChart({ tasks, cellWidth, days, onTaskClick }: GanttChartProps) {
  const defaultDays = ['J-5', 'J-4', 'J-3', 'J-2', 'J-1', 'JOUR J', 'J+1'];
  const dayLabels = days && days.length > 0 ? days : defaultDays;

  const formatDate = (rawDate?: string | null) => {
    if (!rawDate) return 'N/A';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (tasks.length === 0) {
    return (
      <div className="app-card rounded-2xl p-10">
        <div className="dash-empty-state !p-6">
          <span className="material-symbols-outlined text-3xl app-text-muted mb-2">event_note</span>
          <p className="text-sm app-text-muted">Aucune mission ne correspond aux filtres actifs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-card rounded-2xl overflow-hidden flex flex-col">
      <div className="md:hidden p-4 space-y-3">
        {tasks.map((task) => (
          <button
            type="button"
            key={task.id}
            onClick={() => onTaskClick?.(task.id)}
            className={`w-full text-left rounded-xl border p-4 transition hover:border-[var(--landing-primary)]/40 ${
              task.isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--md-border)] bg-[var(--md-surface)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold app-heading truncate">{task.title}</h4>
                <p className="mt-1 text-xs app-text-muted">{task.assignee.name}</p>
              </div>
              <span className={getStatusClass(task.status)}>{task.status}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="app-text-muted">Début</span>
                <span className="app-heading">{formatDate(task.startDate)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="app-text-muted">Fin</span>
                <span className="app-heading">{formatDate(task.endDate)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden md:flex-1 md:block md:overflow-auto custom-scrollbar">
        <div className="inline-flex flex-col min-w-full">
          <div className="flex border-b border-[var(--md-border)] bg-[var(--md-surface-muted)] text-xs font-bold uppercase tracking-wider app-text-muted sticky top-0 z-40">
            <div className="w-80 shrink-0 p-4 border-r border-[var(--md-border)] sticky left-0 z-50 bg-[var(--md-surface-muted)]">
              Mission / Action
            </div>
            <div className="w-40 shrink-0 p-4 border-r-2 border-[var(--md-border)] sticky left-80 z-50 bg-[var(--md-surface-muted)]">
              Responsable
            </div>
            <div className="flex">
              {dayLabels.map((day) => (
                <div
                  key={day}
                  className={`shrink-0 p-4 border-r border-[var(--md-border)] text-center text-[10px] ${
                    day === 'JOUR J'
                      ? 'bg-[var(--landing-primary)] text-white font-bold'
                      : ''
                  }`}
                  style={{ width: `${cellWidth}px`, boxSizing: 'border-box' }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {tasks.map((task) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => onTaskClick?.(task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTaskClick?.(task.id);
                  }
                }}
                className={`flex border-b border-[var(--md-border)] transition-colors group h-16 cursor-pointer ${
                  task.isOverdue ? 'bg-red-500/5' : 'hover:bg-[var(--md-surface-muted)]/50'
                }`}
              >
                <div
                  className={`w-80 shrink-0 p-4 border-r border-[var(--md-border)] sticky left-0 z-30 ${
                    task.isOverdue ? 'bg-red-500/5' : 'bg-[var(--md-surface)] group-hover:bg-[var(--md-surface-muted)]/60'
                  }`}
                >
                  <h4 className="font-semibold app-heading truncate text-sm">{task.title}</h4>
                  <span className={`inline-flex mt-1.5 ${getStatusClass(task.status)}`}>{task.status}</span>
                </div>

                <div
                  className={`w-40 shrink-0 p-4 border-r-2 border-[var(--md-border)] sticky left-80 z-30 ${
                    task.isOverdue ? 'bg-red-500/5' : 'bg-[var(--md-surface)] group-hover:bg-[var(--md-surface-muted)]/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {task.assignee.initials}
                    </div>
                    <span className="text-xs font-medium truncate app-text-muted">{task.assignee.name}</span>
                  </div>
                </div>

                <div className={`flex relative items-center min-w-max ${task.isOverdue ? 'bg-red-500/[0.03]' : ''}`}>
                  <div
                    className={`absolute h-7 rounded-md z-10 flex items-center px-2 transition-all duration-300 border ${
                      task.isOverdue
                        ? 'bg-red-500/25 border-red-500/60'
                        : 'bg-primary/20 border-primary/40'
                    }`}
                    style={{
                      left: `${task.startDay * cellWidth}px`,
                      width: `${Math.max(task.duration * cellWidth, 8)}px`,
                    }}
                  >
                    <div
                      className={`w-full h-4 rounded ${
                        task.isOverdue ? 'bg-red-500/80' : 'bg-primary/70'
                      }`}
                    />
                  </div>

                  {dayLabels.map((day) => (
                    <div
                      key={day}
                      className={`shrink-0 h-full border-r border-[var(--md-border)]/50 ${
                        day === 'JOUR J' ? 'bg-primary/[0.04]' : ''
                      }`}
                      style={{ width: `${cellWidth}px`, boxSizing: 'border-box' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-[var(--md-border)] bg-[var(--md-surface-muted)] text-xs app-text-muted">
        {tasks.length} mission{tasks.length > 1 ? 's' : ''} affichée{tasks.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}
