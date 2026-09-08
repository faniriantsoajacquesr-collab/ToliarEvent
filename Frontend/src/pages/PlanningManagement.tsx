import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { API_URL } from '../config/api';
import GanttChart from '../components/GanttChart';
import { PlanningSkeleton } from '../components/skeleton';
import AppPageHeader from '../components/AppPageHeader';
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

const STATUS_FILTERS = [
  { value: 'all' as const, label: 'Tous' },
  { value: 'not-started' as const, label: 'Pas commencé' },
  { value: 'overdue' as const, label: 'En retard' },
  { value: 'in-progress' as const, label: 'En cours' },
  { value: 'completed' as const, label: 'Terminé' },
  { value: 'blocked' as const, label: 'Bloqué' },
];

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
        const evRes = await fetch(`${API_URL}/events/${encodeURIComponent(selectedEventId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const evData = await evRes.json();
        if (evData.success && evData.event) {
          setEventTitle(evData.event.title || evData.event.name || null);
          setEventStartDate(evData.event.start_date ? new Date(evData.event.start_date) : null);
        }

        // fetch tasks
        const res = await fetch(`${API_URL}/tasks?event_id=${encodeURIComponent(selectedEventId)}`, {
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
      const res = await fetch(`${API_URL}/tasks?event_id=${encodeURIComponent(selectedEventId)}`, {
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
      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28 space-y-8">
          <AppPageHeader
            title="Timeline logistique"
            subtitle={eventTitle ? `Planning opérationnel — ${eventTitle}` : 'Planifiez et suivez les missions de votre événement.'}
            actions={
              !isStaffUser ? (
                <button
                  type="button"
                  onClick={() => { if (selectedEventId) setIsModalOpen(true); }}
                  disabled={!selectedEventId}
                  className="badge-editor-cta !w-auto inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Ajouter une tâche
                </button>
              ) : undefined
            }
          />

          {!selectedEventId ? (
            <div className="dash-empty-state">
              <span className="material-symbols-outlined text-4xl text-primary/70 mb-3">event_busy</span>
              <p className="font-landing-display text-lg app-heading mb-1">Aucun événement sélectionné</p>
              <p className="text-sm app-text-muted">Sélectionnez un événement pour afficher le planning logistique.</p>
            </div>
          ) : isLoading ? (
            <PlanningSkeleton />
          ) : (
            <>
              <section>
                <p className="landing-eyebrow mb-4">Vue d&apos;ensemble</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="dash-stat-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="dash-stat-label mb-1">Avancement global</p>
                        <p className="dash-stat-value text-primary">{kpiData.progress}</p>
                      </div>
                      <span className="material-symbols-outlined text-2xl text-primary opacity-80">donut_large</span>
                    </div>
                  </div>
                  <div className="dash-stat-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="dash-stat-label mb-1">Tâches en cours</p>
                        <p className="dash-stat-value">{kpiData.tasksInProgress.toLocaleString('fr-FR')}</p>
                      </div>
                      <span className="material-symbols-outlined text-2xl text-indigo-500 opacity-80">pending_actions</span>
                    </div>
                  </div>
                  <div className={`dash-stat-card ${kpiData.alerts > 0 ? 'border-red-500/35 ring-1 ring-red-500/15' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`dash-stat-label mb-1 ${kpiData.alerts > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                          Alerte retards
                        </p>
                        <p className={`dash-stat-value ${kpiData.alerts > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {kpiData.alerts.toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <span className={`material-symbols-outlined text-2xl opacity-80 ${kpiData.alerts > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                        warning
                      </span>
                    </div>
                  </div>
                  <div className="dash-stat-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="dash-stat-label mb-1">Indice d&apos;assignation</p>
                        <p className="dash-stat-value">{kpiData.assignmentIndex}</p>
                      </div>
                      <span className="material-symbols-outlined text-2xl text-teal-500 opacity-80">assignment_ind</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                  <div>
                    <p className="landing-eyebrow mb-2">Filtres</p>
                    <h2 className="font-landing-display text-xl app-heading">Missions & timeline</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`landing-chip ${viewMode === 'table' ? 'landing-chip--active' : ''}`}
                    >
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('calendar')}
                      className={`landing-chip ${viewMode === 'calendar' ? 'landing-chip--active' : ''}`}
                    >
                      Calendrier
                    </button>
                  </div>
                </div>

                <div className="dash-toolbar flex-col xl:flex-row">
                  <div className="relative flex-[1.4] min-w-[220px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 app-text-muted text-lg pointer-events-none">search</span>
                    <input
                      type="search"
                      placeholder="Rechercher une mission, un assigné ou un mot-clé…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm app-input bg-transparent border-0 focus:outline-none"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                    />
                  </div>
                  <div className="hidden md:flex items-center gap-3 flex-1 min-w-[180px] px-2">
                    <span className="material-symbols-outlined app-text-muted text-lg shrink-0">calendar_view_week</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider app-text-muted shrink-0 hidden sm:block">Largeur</span>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      value={cellWidth}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setCellWidth(value);
                        handleCellWidthChange(value);
                      }}
                      className="flex-1 accent-[var(--landing-primary)]"
                    />
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm app-text-muted cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={onlyMine}
                      onChange={(e) => setOnlyMine(e.target.checked)}
                      className="h-4 w-4 rounded accent-[var(--landing-primary)]"
                    />
                    <span>Mes tâches uniquement</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={`landing-chip ${statusFilter === option.value ? 'landing-chip--active' : ''}`}
                    >
                      {option.label}
                      {option.value === 'overdue' && kpiData.alerts > 0 && (
                        <span className="ml-1 opacity-80">({kpiData.alerts})</span>
                      )}
                    </button>
                  ))}
                </div>

                <GanttChart
                  tasks={filteredTasks}
                  cellWidth={debouncedCellWidth}
                  days={getDisplayLabels()}
                  onTaskClick={handleTaskClick}
                />
              </section>
            </>
          )}
        </div>
      </main>

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
    </>
  );
}
