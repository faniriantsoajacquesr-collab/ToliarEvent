import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import MultiSelectPosts, { defaultPosts } from './MultiSelectPosts';

interface EventModalProps { isOpen: boolean; onClose: () => void; onSuccess: () => void; event?: any }
interface RequiredPost { name: string; slots_needed: number; }

export default function EventModal({ isOpen, onClose, onSuccess, event }: EventModalProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState({ title: '', location: '', start_date: '', end_date: '', description: '', category_id: '' });
  const [requiredPosts, setRequiredPosts] = useState<RequiredPost[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Charger les suggestions de postes basées sur l'historique de l'organisation
  // Two-step flow:
  useEffect(() => {
    if (isOpen && session?.access_token) {
      (async () => {
        try {
          // Determine if current user is admin and load organization skills
          const orgRes = await authAPI.getMyOrganization(session.access_token);
          if (orgRes.success && orgRes.member && orgRes.member.role === 'admin') setIsAdmin(true);

          const skillsRes = await authAPI.getSkills(session.access_token);
          if (skillsRes.success && Array.isArray(skillsRes.skills)) {
            // Use unique skill names as suggestions
            const names = Array.from(new Set(skillsRes.skills.map((s: any) => s.name)));
            setSuggestions(names as string[]);
          }

          const categoriesRes = await authAPI.getEventCategories(session.access_token);
          if (categoriesRes.success && Array.isArray(categoriesRes.categories)) {
            setCategories(categoriesRes.categories.map((cat: any) => ({ id: String(cat.id), name: cat.name })));
          }
        } catch (err) {
          console.error('Erreur chargement suggestions:', err);
        }
      })();
    }
  }, [isOpen, session]);

  // Préremplir le formulaire si on édite un événement
  useEffect(() => {
    if (isOpen && event) {
      const ev = event;
      setFormData({
        title: ev.title || ev.name || '',
        location: ev.location || '',
        start_date: (ev.start_date || ev.rawStartDate || '').slice(0, 16),
        end_date: (ev.end_date || ev.rawEndDate || '').slice(0, 16),
        description: ev.description || '',
        category_id: ev.category ? String(ev.category) : (ev.event_categories?.id ? String(ev.event_categories.id) : ''),
      });
      // load posts if present on event
      if (ev.posts && Array.isArray(ev.posts)) {
        setRequiredPosts(ev.posts.map((p: any) => ({ name: p.name, slots_needed: p.slots_needed || 1 })));
      }
      setCreatedEventId(ev.id || null);
      setStep(1);
    } else if (isOpen) {
      setFormData({ title: '', location: '', start_date: '', end_date: '', description: '', category_id: '' });
      setRequiredPosts([]);
      setCreatedEventId(null);
      setStep(1);
    }
  }, [isOpen, session, event]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Client-side validation: ensure all required fields are present
      if (!formData.title.trim() || !formData.location.trim() || !formData.start_date || !formData.end_date || !formData.description.trim()) {
        alert('Veuillez remplir tous les champs obligatoires, y compris la description.');
        setLoading(false);
        return;
      }

      if (categories.length > 0 && !formData.category_id) {
        alert('Veuillez sélectionner une catégorie d\'événement.');
        setLoading(false);
        return;
      }

      // If step 1 and admin -> just advance UI (no network)
      if (step === 1 && isAdmin) {
        setStep(2);
        setLoading(false);
        return;
      }

      // get organization (needed for create/update when actually saving)
      const orgData = await authAPI.getMyOrganization(session?.access_token || '');
      if (!orgData.success || !orgData.organization) throw new Error('Organisation introuvable');

      const editingEvent = event;

      if (step === 1) {
        // Non-admin: create event directly (no posts)
        const createRes = await authAPI.createEvent({
          title: formData.title,
          start_date: formData.start_date,
          end_date: formData.end_date,
          location: formData.location,
          description: formData.description || '',
          category_id: formData.category_id ? Number(formData.category_id) : undefined,
          organization_id: orgData.organization.id,
          posts: [],
        }, session?.access_token || '');
        if (createRes.success) {
          onSuccess(); onClose();
        }
        setLoading(false);
        return;
      }

      // step === 2: final save (create with posts or update existing event with posts)
      const targetId = createdEventId || (editingEvent && editingEvent.id);
      if (targetId) {
        const res = await fetch(`http://localhost:5000/api/auth/events/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            ...formData,
            category_id: formData.category_id ? Number(formData.category_id) : undefined,
            posts: requiredPosts,
          }),
        });
        const data = await res.json();
        if (data.success) {
          onSuccess(); onClose();
        }
      } else {
        const createRes = await authAPI.createEvent({
          title: formData.title,
          start_date: formData.start_date,
          end_date: formData.end_date,
          location: formData.location,
          description: formData.description || '',
          category_id: formData.category_id ? Number(formData.category_id) : undefined,
          organization_id: orgData.organization.id,
          posts: requiredPosts,
        }, session?.access_token || '');
        if (createRes.success) {
          onSuccess(); onClose();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const editingEvent = event;
    if (!editingEvent || !editingEvent.id) return;
    if (!confirm('Voulez-vous vraiment supprimer cet événement ?')) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/auth/events/${editingEvent.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await res.json();
      if (data.success) { onSuccess(); onClose(); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-gutter">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-md">
          <h2 className="text-headline-md font-bold">{event ? 'Modifier l\'événement' : 'Créer un événement'}</h2>
          {event && (
            <button type="button" onClick={handleDelete} className="text-sm text-error bg-error/10 px-3 py-1 rounded-lg">Supprimer</button>
          )}
        </div>

        <div className="flex gap-6 items-center mb-sm">
          <div className={`text-sm font-medium ${step === 1 ? 'text-primary' : 'text-on-surface-variant'}`}>1. Infos</div>
          <div className={`text-sm font-medium ${step === 2 ? 'text-primary' : 'text-on-surface-variant'}`}>2. Postes</div>
        </div>

        <div className="w-full bg-surface-variant h-2 rounded-full mb-lg overflow-hidden">
          <div className={`h-2 bg-primary transition-all`} style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>
        <form onSubmit={handleSubmit} className="space-y-lg">
          {step === 1 && (
            <div>
              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="text-label-md font-bold ml-xs">Titre</label>
                  <input required className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm" placeholder="Nom de l'événement" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="space-y-xs">
                  <label className="text-label-md font-bold ml-xs">Lieu</label>
                  <input required className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm" placeholder="Ex: Gymnase Couvert" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="text-label-md font-bold ml-xs">Catégorie</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm"
                  >
                    <option value="">Sélectionnez une catégorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="text-label-md font-bold ml-xs">Début</label>
                  <input required type="datetime-local" className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div className="space-y-xs">
                  <label className="text-label-md font-bold ml-xs">Fin</label>
                  <input required type="datetime-local" className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-label-md font-bold ml-xs">Description</label>
                <textarea required rows={4} className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm" placeholder="Description du projet / logistique" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div>
                <div className="flex justify-end gap-md pt-md">
                  <button type="button" className="px-lg py-sm text-on-surface-variant font-bold hover:bg-surface-variant rounded-lg transition-colors" onClick={onClose}>Annuler</button>
                  <button type="submit" disabled={loading} className="px-lg py-sm bg-primary text-on-primary font-bold rounded-lg shadow-md hover:opacity-90 transition-opacity">
                    {loading ? 'Traitement...' : (isAdmin ? 'Suivant' : 'Créer l\'événement')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && isAdmin && (
            <div>
              <MultiSelectPosts
                value={requiredPosts}
                onChange={(v) => setRequiredPosts(v)}
                suggestions={Array.from(new Set([...(suggestions || []), ...defaultPosts]))}
              />

              <div className="flex justify-between gap-md pt-md">
                <button type="button" className="px-lg py-sm text-on-surface-variant font-bold hover:bg-surface-variant rounded-lg transition-colors" onClick={() => setStep(1)}>Retour</button>
                <button type="submit" disabled={loading} className="px-lg py-sm bg-primary text-on-primary font-bold rounded-lg shadow-md hover:opacity-90 transition-opacity">{loading ? 'Enregistrement...' : 'Enregistrer les postes'}</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}