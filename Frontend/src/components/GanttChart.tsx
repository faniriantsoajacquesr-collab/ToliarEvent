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

export type { GanttTask };
export default function GanttChart({ tasks, cellWidth, days, onTaskClick }: GanttChartProps) {
  const defaultDays = ['J-5', 'J-4', 'J-3', 'J-2', 'J-1', 'JOUR J', 'J+1'];
  const dayLabels = days && days.length > 0 ? days : defaultDays;

  const formatDate = (rawDate?: string | null) => {
    if (!rawDate) return 'N/A';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
      <div className="md:hidden p-md">
        <div className="space-y-3">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => onTaskClick?.(task.id)}
              className="w-full text-left rounded-3xl border border-outline-variant bg-surface p-4 shadow-sm transition hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-on-surface truncate">{task.title}</h4>
                  <p className="mt-1 text-xs text-on-surface-variant">{task.assignee.name}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
                    task.status === 'En cours' ? 'bg-blue-100 text-blue-700' :
                    task.status === 'Terminé' ? 'bg-green-100 text-green-700' :
                    task.status === 'Bloqué' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                  {task.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-on-surface">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-on-surface-variant">Début</span>
                  <span>{formatDate(task.startDate)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-on-surface-variant">Fin</span>
                  <span>{formatDate(task.endDate)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:flex-1 md:block md:overflow-auto custom-scrollbar">
        <div className="inline-flex flex-col min-w-full">
          {/* Gantt Header */}
          <div className="flex border-b border-outline-variant bg-surface-container-low font-label-md text-on-surface-variant sticky top-0 z-40">
            <div className="w-80 shrink-0 p-md border-r border-outline-variant sticky left-0 z-50 bg-surface-container-low">
              Mission / Action
            </div>
            <div className="w-40 shrink-0 p-md border-outline-variant sticky left-80 z-50 bg-surface-container-low border-r-2">
              Responsable
            </div>
            <div className="flex">
              {dayLabels.map((day) => (
                <div
                  key={day}
                  className={`shrink-0 p-md border-r border-outline-variant text-center ${
                    day === 'JOUR J' ? 'bg-primary-container text-white' : ''
                  }`}
                  style={{ width: `${cellWidth}px`, boxSizing: 'border-box' }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Body */}
          <div className="relative">
            {tasks.map((task) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => onTaskClick?.(task.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTaskClick?.(task.id); } }}
                className={`flex border-b border-outline-variant transition-colors group h-16 cursor-pointer ${task.isOverdue ? 'bg-red-50/80' : 'hover:bg-surface-container-lowest'}`}
              >
                {/* Task Name & Status (Sticky) */}
                <div className={`w-80 shrink-0 p-md border-r border-outline-variant sticky left-0 z-30 ${task.isOverdue ? 'bg-red-50 border-red-200' : 'bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors'}`}>
                  <h4 className="font-bold text-on-surface truncate">{task.title}</h4>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-bold uppercase ${
                      task.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 
                      task.status === 'Terminé' ? 'bg-green-100 text-green-700' : 
                      task.status === 'Bloqué' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {task.status}
                  </span>
                </div>

                {/* Assignee (Sticky) */}
                <div className={`w-40 shrink-0 p-md border-r-2 border-outline-variant sticky left-80 z-30 ${task.isOverdue ? 'bg-red-50 border-red-200' : 'bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors'}`}>
                  <div className="flex items-center gap-sm">
                    <div className={`w-6 h-6 rounded-full ${task.assignee.color} text-white flex items-center justify-center text-[10px] font-bold`}>
                      {task.assignee.initials}
                    </div>
                    <span className="text-xs font-medium truncate">{task.assignee.name}</span>
                  </div>
                </div>

                {/* Timeline Grid */}
                <div className={`flex relative items-center min-w-max ${task.isOverdue ? 'bg-red-50/70' : ''}`}>
                  {/* Task Bar */}
                  <div
                    className={`absolute h-8 ${task.isOverdue ? 'bg-red-500/20 border-red-500' : task.backgroundColor} border-y ${task.isOverdue ? 'border-red-500' : task.borderColor} rounded-md z-10 flex items-center px-2 transition-all duration-300`}
                    style={{
                      left: `${task.startDay * cellWidth}px`,
                      width: `${task.duration * cellWidth}px`,
                    }}
                  >
                    <div className={`w-full h-full ${task.isOverdue ? 'bg-red-500' : task.backgroundColor.replace('/20', '')} rounded-md`}></div>
                  </div>

                  {/* Day Columns BG */}
                  {dayLabels.map((day) => (
                    <div
                      key={day}
                      className="shrink-0 h-full border-r border-outline-variant/20 group-hover:bg-surface-container-lowest/50"
                      style={{ width: `${cellWidth}px`, boxSizing: 'border-box' }}
                    ></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
