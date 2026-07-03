import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import { updateTaskStatus } from '../services/taskService';

export interface ServerTask {
  id: string;
  event_id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  profiles?: { id: string; first_name: string; last_name: string } | null;
}

interface StaffOption {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
}

interface TaskDetailsModalProps {
  isOpen: boolean;
  task: ServerTask | null;
  eventTitle?: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const STATUS_OPTIONS = ['Pas commencé', 'En cours', 'En attente', 'Terminé', 'Bloqué'];

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '').slice(0, 1)}${(lastName || '').slice(0, 1)}`.toUpperCase() || '?';
}

function getStatusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('cours')) return 'bg-blue-100 text-blue-700';
  if (s.includes('term') || s.includes('fin')) return 'bg-green-100 text-green-700';
  if (s.includes('bloqu')) return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function StaffAssignmentPicker({
  options,
  value,
  onChange,
}: {
  options: StaffOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.firstName.toLowerCase().includes(q) ||
        o.lastName.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectableItems = useMemo(
    () => [{ id: null as string | null, name: 'Non assigné', firstName: '', lastName: '' }, ...filtered.map((o) => ({ ...o, id: o.id as string | null }))],
    [filtered]
  );

  useEffect(() => {
    setFocusedIndex(-1);
  }, [query]);

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, selectableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      onChange(selectableItems[focusedIndex].id);
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className="space-y-md">
      {selected && (
        <div className="flex items-center gap-md p-md rounded-xl bg-primary/5 border border-primary/20">
          <div className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
            {getInitials(selected.firstName, selected.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Assigné actuellement</p>
            <p className="text-body-md font-semibold text-on-surface truncate">{selected.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors"
            title="Retirer l'assignation"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden shadow-sm">
        <div className="p-sm bg-surface-bright border-b border-outline-variant">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl pointer-events-none">
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher par nom ou prénom..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-surface-container-low border border-outline-variant/60 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all placeholder:text-on-surface-variant/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
          <p className="mt-2 px-1 text-[11px] text-on-surface-variant">
            {filtered.length} personne{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
            {query && ` pour « ${query} »`}
          </p>
        </div>

        <div ref={listRef} className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/30">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`w-full flex items-center gap-md px-md py-3 text-left transition-colors ${
              !value
                ? 'bg-primary/8 hover:bg-primary/10'
                : 'hover:bg-surface-container-high'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 border-dashed ${
              !value ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-lg">person_off</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${!value ? 'text-primary' : 'text-on-surface'}`}>Non assigné</p>
              <p className="text-xs text-on-surface-variant">La tâche reste sans responsable</p>
            </div>
            {!value && (
              <span className="material-symbols-outlined text-primary text-xl shrink-0">check_circle</span>
            )}
          </button>

          {filtered.map((person, index) => {
            const isSelected = value === person.id;
            const isFocused = focusedIndex === index + 1;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onChange(person.id)}
                onMouseEnter={() => setFocusedIndex(index + 1)}
                className={`w-full flex items-center gap-md px-md py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-primary/8 hover:bg-primary/10'
                    : isFocused
                      ? 'bg-surface-container-high'
                      : 'hover:bg-surface-container-high'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isSelected ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-highest text-on-surface-variant'
                }`}>
                  {getInitials(person.firstName, person.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                    {highlightMatch(person.name, query)}
                  </p>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-primary text-xl shrink-0">check_circle</span>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-md text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">person_search</span>
              <p className="text-sm font-medium text-on-surface-variant">Aucune personne trouvée</p>
              <p className="text-xs text-on-surface-variant/70 mt-1">Essayez un autre nom ou prénom</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step, isEditing }: { step: 1 | 2; isEditing: boolean }) {
  const steps = [
    { num: 1, label: isEditing ? 'Informations' : 'Détails' },
    { num: 2, label: 'Assignation' },
  ] as const;

  return (
    <div className="px-lg py-md bg-surface-container-low border-b border-outline-variant/30">
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-8 h-px ${step === 2 ? 'bg-primary' : 'bg-outline-variant'}`} />
            )}
            <div className={`flex items-center gap-2 ${step === s.num ? 'text-primary' : 'text-on-surface-variant'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                step === s.num ? 'bg-primary text-on-primary' : step > s.num ? 'bg-primary/20 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {step > s.num ? (
                  <span className="material-symbols-outlined text-sm">check</span>
                ) : (
                  s.num
                )}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${step === s.num ? 'font-bold' : ''}`}>
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 w-full h-1 bg-outline-variant/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>
    </div>
  );
}

export default function TaskDetailsModal({
  isOpen,
  task,
  eventTitle,
  onClose,
  onUpdated,
}: TaskDetailsModalProps) {
  const { session, user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const isAdmin = user?.role?.toString().toLowerCase() === 'admin';
  const isAssignedToMe = Boolean(
    task && user?.id && (
      task.assigned_to === user.id ||
      task.profiles?.id === user.id
    )
  );
  const canFullEdit = isAdmin;
  const canUpdateStatus = !isAdmin && isAssignedToMe;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  const resetFormFromTask = () => {
    if (!task) return;
    setTitle(task.title || '');
    setDescription(task.description || '');
    setStartDate(toDatetimeLocal(task.start_date));
    setEndDate(toDatetimeLocal(task.end_date));
    setStatus(task.status || 'Pas commencé');
    setAssignedTo(task.assigned_to || null);
  };

  useEffect(() => {
    if (!isOpen || !task) return;
    setStep(1);
    setIsEditing(false);
    resetFormFromTask();
  }, [isOpen, task]);

  useEffect(() => {
    if (!isOpen || !task?.event_id || !session?.access_token) return;
    const fetchStaff = async () => {
      try {
        const res = await authAPI.getEventStaff(task.event_id, session.access_token, 'valide');
        if (res.success && Array.isArray(res.staff)) {
          setStaffOptions(
            res.staff
              .map((s: any) => {
                const profile = s.profile || s.profiles || null;
                return profile
                  ? {
                      id: profile.id,
                      name: `${profile.first_name} ${profile.last_name}`,
                      firstName: profile.first_name || '',
                      lastName: profile.last_name || '',
                    }
                  : null;
              })
              .filter(Boolean) as StaffOption[]
          );
          return;
        }

        console.debug('TaskDetailsModal getEventStaff failed, fallback to org members:', res?.error);
        const orgRes = await authAPI.getMyOrganization(session.access_token);
        if (orgRes.success && orgRes.organization) {
          const membersRes = await authAPI.getOrganizationMembers(orgRes.organization.id, '', 'all', session.access_token);
          if (membersRes.success && Array.isArray(membersRes.members)) {
            setStaffOptions(
              membersRes.members
                .filter((m: any) => (m.profile?.id || m.profiles?.id))
                .map((m: any) => ({
                  id: m.profile?.id ?? m.profiles?.id,
                  name: m.profile ? `${m.profile.first_name} ${m.profile.last_name}` : `${m.profiles.first_name} ${m.profiles.last_name}`,
                  firstName: m.profile?.first_name || m.profiles?.first_name || '',
                  lastName: m.profile?.last_name || m.profiles?.last_name || '',
                }))
            );
          }
        }
      } catch (err) {
        console.error('fetch staff error', err);
      }
    };
    fetchStaff();
  }, [isOpen, task?.event_id, session]);

  const handleClose = () => {
    setStep(1);
    setIsEditing(false);
    onClose();
  };

  const handleCancelEdit = () => {
    resetFormFromTask();
    setIsEditing(false);
    setStep(1);
  };

  const handleSave = async () => {
    if (!task || !session?.access_token) return;
    setLoading(true);
    try {
      const body = {
        title,
        description: description || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
        assigned_to: assignedTo,
      };
      const resp = await fetch(`http://localhost:5000/api/auth/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.success) {
        setIsEditing(false);
        setStep(1);
        if (onUpdated) onUpdated();
        onClose();
      } else {
        alert(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!task || !session?.access_token) return;
    setLoading(true);
    try {
      const result = await updateTaskStatus(task.id, status, session.access_token);
      if (result.success) {
        if (onUpdated) onUpdated();
        onClose();
      } else {
        alert(result.error || 'Erreur lors de la mise à jour du statut');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise à jour du statut');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  const displayAssignee = isEditing
    ? staffOptions.find((o) => o.id === assignedTo)
    : task.profiles
      ? { name: `${task.profiles.first_name} ${task.profiles.last_name}`, firstName: task.profiles.first_name, lastName: task.profiles.last_name }
      : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-md"
      onClick={handleClose}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-lg py-md border-b border-outline-variant/30 flex items-center justify-between bg-surface-bright shrink-0">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {isEditing ? 'Modifier la tâche' : 'Détails de la tâche'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {isEditing
                ? (step === 1 ? 'Étape 1 — Informations générales' : 'Étape 2 — Assignation')
                : 'Consultation des informations'}
            </p>
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors"
            onClick={handleClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {isEditing && <StepIndicator step={step} isEditing={isEditing} />}

        <div className="p-lg overflow-y-auto flex-1 custom-scrollbar">
          {(!isEditing || step === 1) && (
            <div className="space-y-md">
              <div>
                <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Événement</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={eventTitle || 'Événement'}
                    disabled
                    className="w-full p-sm border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant"
                  />
                ) : (
                  <p className="text-body-md text-on-surface">{eventTitle || '—'}</p>
                )}
              </div>

              <div>
                <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Titre</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full p-sm border border-outline-variant rounded-lg bg-surface-bright focus:ring-2 focus:ring-primary outline-none"
                  />
                ) : (
                  <p className="text-body-md font-semibold text-on-surface">{task.title}</p>
                )}
              </div>

              <div>
                <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Description</label>
                {isEditing ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full p-sm border border-outline-variant rounded-lg bg-surface-bright focus:ring-2 focus:ring-primary outline-none resize-none"
                  />
                ) : (
                  <p className="text-body-md text-on-surface-variant whitespace-pre-wrap">
                    {task.description || '—'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Date début</label>
                  {isEditing ? (
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-sm border border-outline-variant rounded-lg bg-surface-bright focus:ring-2 focus:ring-primary outline-none"
                    />
                  ) : (
                    <p className="text-body-md text-on-surface">{formatDateTime(task.start_date)}</p>
                  )}
                </div>
                <div>
                  <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Date fin</label>
                  {isEditing ? (
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-sm border border-outline-variant rounded-lg bg-surface-bright focus:ring-2 focus:ring-primary outline-none"
                    />
                  ) : (
                    <p className="text-body-md text-on-surface">{formatDateTime(task.end_date)}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Statut</label>
                {isEditing ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-sm border border-outline-variant rounded-lg bg-surface-bright focus:ring-2 focus:ring-primary outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : canUpdateStatus ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-sm border border-outline-variant rounded-lg bg-surface-bright focus:ring-2 focus:ring-primary outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-flex items-center px-sm py-xs rounded-full text-xs font-bold uppercase ${getStatusBadgeClass(task.status || '')}`}>
                    {task.status || '—'}
                  </span>
                )}
              </div>

              {!isEditing && (
                <div>
                  <label className="block font-label-md text-label-md mb-xs text-on-surface-variant">Assigné à</label>
                  {displayAssignee ? (
                    <div className="flex items-center gap-md p-md rounded-xl border border-outline-variant bg-surface-bright">
                      <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold shadow-sm">
                        {getInitials(displayAssignee.firstName, displayAssignee.lastName)}
                      </div>
                      <p className="text-body-md font-medium text-on-surface">{displayAssignee.name}</p>
                    </div>
                  ) : (
                    <p className="text-body-md text-on-surface-variant">Non assigné</p>
                  )}
                </div>
              )}
            </div>
          )}

          {isEditing && step === 2 && (
            <div className="space-y-md">
              <div className="flex items-start gap-sm p-md rounded-xl bg-surface-container-low border border-outline-variant/50">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">assignment_ind</span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Choisissez le responsable</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Recherchez et sélectionnez un membre du staff pour cette mission.
                  </p>
                </div>
              </div>

              <StaffAssignmentPicker
                options={staffOptions}
                value={assignedTo}
                onChange={setAssignedTo}
              />
            </div>
          )}
        </div>

        <div className="px-lg py-md border-t border-outline-variant/30 bg-surface-bright flex justify-between gap-md shrink-0">
          <div>
            {isEditing && step === 2 && (
              <button
                type="button"
                className="px-lg py-sm rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors flex items-center gap-1"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Retour
              </button>
            )}
          </div>

          <div className="flex gap-md">
            {isEditing ? (
              <>
                {step === 1 && (
                  <>
                    <button
                      type="button"
                      className="px-lg py-sm rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors"
                      onClick={handleCancelEdit}
                      disabled={loading}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="px-lg py-sm rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1"
                      onClick={() => setStep(2)}
                      disabled={!title.trim()}
                    >
                      Suivant
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>
                  </>
                )}
                {step === 2 && (
                  <button
                    type="button"
                    className="px-lg py-sm rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 transition-all disabled:opacity-50"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="px-lg py-sm rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors"
                  onClick={handleClose}
                >
                  Fermer
                </button>
                {canUpdateStatus && status !== (task.status || 'Pas commencé') ? (
                  <button
                    type="button"
                    className="px-lg py-sm rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 transition-all disabled:opacity-50"
                    onClick={handleStatusUpdate}
                    disabled={loading}
                  >
                    {loading ? 'Enregistrement...' : 'Mettre à jour le statut'}
                  </button>
                ) : null}
                {canFullEdit ? (
                  <button
                    type="button"
                    className="px-lg py-sm rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 transition-all"
                    onClick={() => { setIsEditing(true); setStep(1); }}
                  >
                    Modifier
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
