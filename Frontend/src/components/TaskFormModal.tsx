import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';

export default function TaskFormModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string | null;
  eventTitle?: string | null;
  onCreated?: () => void;
}) {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // fetch event staff once when modal opens
    const fetchStaff = async () => {
      if (!eventId || !session?.access_token) return;
      try {
        const res = await authAPI.getEventStaff(eventId, session.access_token, 'valide');
        if (res.success && Array.isArray(res.staff)) {
          setStaffOptions(res.staff.map((s: any) => {
            const profile = s.profile || s.profiles || null;
            return {
              id: profile?.id,
              name: profile ? `${profile.first_name} ${profile.last_name}` : 'Inconnu',
            };
          }));
          return;
        }

        console.debug('TaskFormModal getEventStaff failed, fallback to org members:', res?.error);
        const orgRes = await authAPI.getMyOrganization(session.access_token);
        if (orgRes.success && orgRes.organization) {
          const membersRes = await authAPI.getOrganizationMembers(orgRes.organization.id, '', 'all', session.access_token);
          if (membersRes.success && Array.isArray(membersRes.members)) {
            setStaffOptions(membersRes.members.map((m: any) => ({ id: m.profile?.id ?? m.profiles?.id, name: m.profile ? `${m.profile.first_name} ${m.profile.last_name}` : m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Inconnu' })));
          }
        }
      } catch (err) {
        console.error('fetch staff error', err);
      }
    };
    fetchStaff();
  }, [isOpen, eventId, session]);

  const filtered = staffOptions.filter(s => s.name.toLowerCase().includes(staffQuery.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !session?.access_token) return;
    setLoading(true);
    try {
      const body: any = {
        event_id: eventId,
        title,
        description,
        start_date: startDate || null,
        end_date: endDate || null,
        // status defaults to DB default
        assigned_to: assignedTo || null,
      };

      const resp = await fetch('http://localhost:5000/api/auth/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.success) {
        if (onCreated) onCreated();
        onClose();
      } else {
        alert(data.error || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Ajouter une tâche</h3>
          <button onClick={onClose} className="text-sm">Fermer</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Événement</label>
            <input
              type="text"
              value={eventTitle || 'Événement non sélectionné'}
              disabled
              className="w-full p-2 border rounded bg-surface-container-low text-on-surface-variant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border rounded" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Date & heure début</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date & heure fin</label>
              <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full p-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Assigné à</label>
            <input placeholder="Rechercher..." value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} className="w-full p-2 border rounded mb-2" />
            <div className="max-h-40 overflow-auto border rounded">
              {filtered.map((s) => (
                <div key={s.id} className={`p-2 cursor-pointer ${assignedTo === s.id ? 'bg-primary/10' : ''}`} onClick={() => setAssignedTo(s.id)}>
                  {s.name}
                </div>
              ))}
              {filtered.length === 0 && <div className="p-2 text-sm text-on-surface-variant">Aucun résultat</div>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-primary text-white">{loading ? 'Enregistrement...' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
