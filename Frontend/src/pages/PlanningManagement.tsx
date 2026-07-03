import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import GanttChart from '../components/GanttChart';
import LoadingOverlay from '../components/LoadingOverlay';
import type { GanttTask } from '../components/GanttChart';
import { useAuth } from '../contexts/AuthContext';
import TaskFormModal from '../components/TaskFormModal';
import TaskDetailsModal, { type ServerTask } from '../components/TaskDetailsModal';

interface KPIData {
  progress: string;
  tasksInProgress: number;
  alerts: number;
  assignmentIndex: string;
}

export default function PlanningManagement({ selectedEventId }: { selectedEventId?: string | null }) {
  const [filterText, setFilterText] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [cellWidth, setCellWidth] = useState(0); // Largeur actuelle du slider
  const [debouncedCellWidth, setDebouncedCellWidth] = useState(0); // Largeur utilisée par le GanttChart
  const [statusFilter, setStatusFilter] = useState<'all' | 'not-started' | 'overdue' | 'in-progress' | 'completed' | 'blocked'>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce la mise à jour de la largeur de cellule
  const handleCellWidthChange = useCallback((value: number) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedCellWidth(value);
    }, 150); // Délai de 150ms
  }, []);

  useEffect(() => {
    // Nettoyer le timeout si le composant est démonté
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const { session, user } = useAuth();
  const isStaffUser = user?.role?.toString().toLowerCase() === 'staff';
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [serverTasks, setServerTasks] = useState<any[]>([]);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [eventStartDate, setEventStartDate] = useState<Date | null>(null);
  const [daysLabels, setDaysLabels] = useState<string[]>([]);
  const [daysStartDate, setDaysStartDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ServerTask | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const toDateOnly = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const getTimelineBounds = (tasksList: any[], baseStart?: Date | null) => {
    let start: Date | null = baseStart ? toDateOnly(baseStart) : null;
    let end: Date | null = baseStart ? toDateOnly(baseStart) : null;

    tasksList.forEach((task) => {
      if (task.start_date) {
        const sd = toDateOnly(new Date(task.start_date));
        if (!start || sd.getTime() < start.getTime()) start = sd;
        if (!end || sd.getTime() > end.getTime()) end = sd;
      }
      if (task.end_date) {
        const ed = toDateOnly(new Date(task.end_date));
        if (!start || ed.getTime() < start.getTime()) start = ed;
        if (!end || ed.getTime() > end.getTime()) end = ed;
      }
    });

    return { start, end };
  };

  const mapServerTask = (t: any, timelineStart?: Date | null): GanttTask => {
    const title = t.title || 'Sans titre';
    const assigned = t.profiles || null;
    const assigneeName = assigned ? `${assigned.first_name} ${assigned.last_name}` : 'Non assigné';
    const initials = assigned ? `${(assigned.first_name || '').slice(0,1)}${(assigned.last_name || '').slice(0,1)}`.toUpperCase() : 'NA';
    const msPerDay = 1000 * 60 * 60 * 24;

    let duration = 1;
    let startDay = 0;
    let isOverdue = false;
    try {
      if (t.start_date && t.end_date) {
        const sd = toDateOnly(new Date(t.start_date));
        const ed = toDateOnly(new Date(t.end_date));
        duration = Math.max(1, Math.round((ed.getTime() - sd.getTime()) / msPerDay) + 1);
      }
    } catch (e) {
      duration = 1;
    }

    try {
      const statusText = (t.status || '').toString().toLowerCase();
      const isCompleted = statusText.includes('term') || statusText.includes('fin');
      const endDate = t.end_date ? new Date(t.end_date) : null;
      isOverdue = Boolean(endDate && !isCompleted && endDate.getTime() < Date.now());
    } catch (e) {
      isOverdue = false;
    }

    try {
      if (timelineStart && t.start_date) {
        const sd = toDateOnly(new Date(t.start_date));
        const diff = Math.floor((sd.getTime() - timelineStart.getTime()) / msPerDay);
        startDay = Math.max(0, diff);
      }
    } catch (e) {
      startDay = 0;
    }

    return {
      id: t.id,
      title,
      assignee: {
        initials,
        name: assigneeName,
        color: 'bg-surface-variant',
      },
      status: (t.status || 'Pas commencé') as any,
      startDay,
      duration,
      startDate: t.start_date || null,
      endDate: t.end_date || null,
      backgroundColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500',
      isOverdue,
    };
  };

  useEffect(() => {
    const fetchAll = async () => {
      if (!selectedEventId || !session?.access_token) return;
      setIsLoading(true);
      try {
        // fetch event
        const evRes = await fetch(`http://localhost:5000/api/auth/events/${encodeURIComponent(selectedEventId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const evData = await evRes.json();
        if (evData.success && evData.event) {
          setEventTitle(evData.event.title || evData.event.name || null);
          setEventStartDate(evData.event.start_date ? new Date(evData.event.start_date) : null);
        }

        // fetch tasks
        const res = await fetch(`http://localhost:5000/api/auth/tasks?event_id=${encodeURIComponent(selectedEventId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.tasks)) {
          setServerTasks(data.tasks || []);
          const base = evData && evData.event && evData.event.start_date ? new Date(evData.event.start_date) : null;
          const { start: timelineStart, end: timelineEnd } = getTimelineBounds(data.tasks || [], base);
          const mapped = (data.tasks || []).map((t: any) => mapServerTask(t, timelineStart));
          setTasks(mapped);

          if (timelineStart && timelineEnd) {
            const msPerDay = 1000 * 60 * 60 * 24;
            const totalDays = Math.max(1, Math.round((timelineEnd.getTime() - timelineStart.getTime()) / msPerDay) + 1);
            const labels: string[] = [];

            for (let i = 0; i < totalDays; i++) {
              const d = new Date(timelineStart.getTime() + i * msPerDay);
              const shortDay = d.toLocaleDateString(undefined, { weekday: 'short' }).replace(/\./g, '');
              const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
              labels.push(`${shortDay}, ${date}`);
            }
            setDaysLabels(labels);
            setDaysStartDate(timelineStart);
          }
        }
      } catch (err) {
        console.error('Erreur fetch tasks/event:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [selectedEventId, session]);

  // Génère les labels des colonnes selon le mode (table ou calendar)
  const getDisplayLabels = (): string[] => {
    if (viewMode === 'table' && eventStartDate && daysStartDate) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const eventIndex = Math.round((toDateOnly(eventStartDate).getTime() - toDateOnly(daysStartDate).getTime()) / msPerDay);
      return daysLabels.map((_, index) => {
        const offset = index - eventIndex;
        if (offset === 0) return 'JOUR J';
        return offset > 0 ? `J+${offset}` : `J${offset}`;
      });
    }
    return daysLabels;
  };

  // compute KPIs from serverTasks and mapped tasks
  const kpiData: KPIData = (() => {
    const total = serverTasks.length;
    const completed = serverTasks.filter((t) => (t.status || '').toString().toLowerCase().includes('term') || (t.status || '').toString().toLowerCase().includes('fin')).length;
    const inProgress = serverTasks.filter((t) => (t.status || '').toString().toLowerCase().includes('en cours')).length;
    const alerts = serverTasks.filter((t) => {
      try {
        const end = t.end_date ? new Date(t.end_date) : null;
        if (!end) return false;
        const now = new Date();
        return end.getTime() < now.getTime() && !(t.status || '').toString().toLowerCase().includes('term');
      } catch (e) {
        return false;
      }
    }).length;
    const assignedCount = serverTasks.filter((t) => t.assigned_to).length;
    const progress = total === 0 ? '0%' : `${Math.round((completed / total) * 100)}%`;
    const assignmentIndex = `${assignedCount} / ${total}`;
    return { progress, tasksInProgress: inProgress, alerts, assignmentIndex } as KPIData;
  })();

  const refreshTasks = async () => {
    if (!selectedEventId || !session?.access_token) return;
    try {
      const res = await fetch(`http://localhost:5000/api/auth/tasks?event_id=${encodeURIComponent(selectedEventId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        setServerTasks(data.tasks || []);
        const base = eventStartDate || null;
        const { start: timelineStart, end: timelineEnd } = getTimelineBounds(data.tasks || [], base);
        const mapped = (data.tasks || []).map((t: any) => mapServerTask(t, timelineStart));
        setTasks(mapped);

        if (timelineStart && timelineEnd) {
          const msPerDay = 1000 * 60 * 60 * 24;
          const totalDays = Math.max(1, Math.round((timelineEnd.getTime() - timelineStart.getTime()) / msPerDay) + 1);
          const labels: string[] = [];

          for (let i = 0; i < totalDays; i++) {
            const d = new Date(timelineStart.getTime() + i * msPerDay);
            const shortDay = d.toLocaleDateString(undefined, { weekday: 'short' }).replace(/\./g, '');
            const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
            labels.push(`${shortDay}, ${date}`);
          }
          setDaysLabels(labels);
          setDaysStartDate(timelineStart);
        }
      }
    } catch (err) {
      console.error('Erreur refresh tasks:', err);
    }
  };

  const handleTaskClick = (taskId: string) => {
    const task = serverTasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsDetailsModalOpen(true);
    }
  };

  // Filtrer les tâches selon le texte de recherche, le statut et l'assignation
  const filteredTasks = useMemo(() => {
    const normalizedQuery = filterText.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    const currentUserName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim().toLowerCase();
    const currentUserId = user?.id;

    return tasks.filter((task) => {
      const sourceTask = serverTasks.find((serverTask) => serverTask.id === task.id);
      const title = (sourceTask?.title || task.title || '').toString().toLowerCase();
      const assigneeName = sourceTask?.profiles
        ? `${sourceTask.profiles.first_name || ''} ${sourceTask.profiles.last_name || ''}`.trim().toLowerCase()
        : (task.assignee?.name || '').toLowerCase();
      const description = (sourceTask?.description || '').toString().toLowerCase();
      const haystack = `${title} ${assigneeName} ${description}`.toLowerCase();
      const matchesSearch = queryTerms.length === 0 || queryTerms.every((term) => haystack.includes(term));

      const normalizedStatus = (sourceTask?.status || task.status || '').toString().toLowerCase();
      let matchesStatus = true;
      if (statusFilter === 'not-started') {
        matchesStatus = normalizedStatus.includes('pas commencé') || normalizedStatus.includes('not started');
      } else if (statusFilter === 'overdue') {
        matchesStatus = Boolean(task.isOverdue);
      } else if (statusFilter === 'in-progress') {
        matchesStatus = normalizedStatus.includes('en cours') || normalizedStatus.includes('in progress');
      } else if (statusFilter === 'completed') {
        matchesStatus = normalizedStatus.includes('term') || normalizedStatus.includes('fin') || normalizedStatus.includes('complete');
      } else if (statusFilter === 'blocked') {
        matchesStatus = normalizedStatus.includes('bloq') || normalizedStatus.includes('blocked');
      }

      const assigneeId = sourceTask?.assigned_to || sourceTask?.profiles?.id || null;
      const currentNameMatch = Boolean(currentUserName && assigneeName && assigneeName === currentUserName);
      const currentIdMatch = Boolean(currentUserId && (String(assigneeId) === String(currentUserId) || String(sourceTask?.profiles?.id) === String(currentUserId)));
      const matchesMine = !onlyMine || currentNameMatch || currentIdMatch;

      return matchesSearch && matchesStatus && matchesMine;
    });
  }, [tasks, serverTasks, filterText, statusFilter, onlyMine, user]);

  return (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-xl pb-xl pt-28 min-h-screen space-y-xl">
        {/* KPIs Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
          <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
            <p className="text-xs font-medium text-on-surface-variant mb-1">Avancement Global</p>
            <h4 className="text-headline-md font-bold text-primary">{kpiData.progress}</h4>
          </div>
          <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
            <p className="text-xs font-medium text-on-surface-variant mb-1">Tâches En Cours</p>
            <h4 className="text-headline-md font-bold text-on-surface">{kpiData.tasksInProgress}</h4>
          </div>
          <div className="bg-error-container p-md rounded-xl border border-error/20 shadow-sm">
            <p className="text-xs font-medium text-on-error-container mb-1">Alerte Retards</p>
            <h4 className="text-headline-md font-bold text-on-error-container">{kpiData.alerts}</h4>
          </div>
          <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm">
            <p className="text-xs font-medium text-on-surface-variant mb-1">Indice d'Assignation</p>
            <h4 className="text-headline-md font-bold text-on-surface">{kpiData.assignmentIndex}</h4>
          </div>
        </div>

        {/* Header & Controls */}
        <div className="flex justify-between items-end gap-lg">
          <div>
            <h3 className="text-headline-lg font-headline-lg text-on-surface">Logistics Timeline</h3>
            <p className="text-on-surface-variant font-body-md">{eventTitle || 'Planning de l\'événement'}</p>
          </div>
          {!isStaffUser && (
            <button
              onClick={() => { if (selectedEventId) setIsModalOpen(true); }}
              disabled={!selectedEventId}
              className={`px-lg py-2.5 rounded-xl font-bold flex items-center gap-md transition-opacity whitespace-nowrap ${selectedEventId ? 'bg-primary text-white hover:opacity-90' : 'bg-outline-variant text-on-surface-variant cursor-not-allowed'}`}>
              <span className="material-symbols-outlined">add</span>
              + Ajouter une tâche
            </button>
          )}
        </div>

        {isLoading && <LoadingOverlay message="Chargement du planning..." />}

        {/* Search & Filter */}
        <div className="flex flex-col gap-md">
          <div className="flex justify-between items-center gap-md">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Rechercher une mission, un assigné ou un mot-clé..."
                className="w-full bg-surface-container-low pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary text-body-md shadow-sm outline-none transition-all"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-md">
              {/* Contrôle de la largeur des cellules (Zoom) */}
              <div className="hidden md:flex items-center gap-md bg-surface-container-low px-lg py-2 rounded-xl border border-outline-variant shadow-sm">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-on-surface-variant text-md">
                    calendar_view_week
                  </span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hidden lg:block">Largeur</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  value={cellWidth}
                  onChange={(e) => { setCellWidth(Number(e.target.value)); handleCellWidthChange(Number(e.target.value)); }}
                  className="w-24 lg:w-32 h-1.5 bg-outline-variant rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="flex bg-surface-container rounded-lg p-1">
                <button
                  className={`px-md py-1.5 rounded-md font-label-md transition-all ${
                    viewMode === 'table'
                      ? 'bg-white shadow-sm text-primary'
                      : 'text-on-surface-variant'
                  }`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
                <button
                  className={`px-md py-1.5 rounded-md font-label-md transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-white shadow-sm text-primary'
                      : 'text-on-surface-variant'
                  }`}
                  onClick={() => setViewMode('calendar')}
                >
                  Calendar
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-md">
            <label className="flex items-center gap-sm bg-surface-container-low px-md py-2 rounded-lg border border-outline-variant text-sm text-on-surface-variant">
              <span className="font-medium">Statut</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'not-started' | 'overdue' | 'in-progress' | 'completed' | 'blocked')}
                className="bg-transparent outline-none text-on-surface"
              >
                <option value="all">Tous</option>
                <option value="not-started">Pas commencé</option>
                <option value="overdue">En retard</option>
                <option value="in-progress">En cours</option>
                <option value="completed">Terminé</option>
                <option value="blocked">Bloqué</option>
              </select>
            </label>

            <label className="flex items-center gap-sm cursor-pointer text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <span>N'afficher que mes tâches</span>
            </label>
          </div>
        </div>

        {/* Gantt Chart */}
        <GanttChart tasks={filteredTasks} cellWidth={debouncedCellWidth} days={getDisplayLabels()} onTaskClick={handleTaskClick} />
        <TaskFormModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); }}
          eventId={selectedEventId}
          eventTitle={eventTitle}
          onCreated={refreshTasks}
        />
        <TaskDetailsModal
          isOpen={isDetailsModalOpen}
          task={selectedTask}
          eventTitle={eventTitle}
          onClose={() => { setIsDetailsModalOpen(false); setSelectedTask(null); }}
          onUpdated={refreshTasks}
        />
      </div>
    </>
  );
}
