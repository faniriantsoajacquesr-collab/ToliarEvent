import { useEffect, useState, useRef } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import ProfileModal from './ProfileModal';

// 1. Correction du type manquant
interface DashboardTopBarProps {
  selectedEvent?: {
    name: string;
    icon: string;
  };
  onSelectEvent?: (eventId: string) => void;
  toggleMobileSidebar?: () => void; // Optionnel pour éviter des régressions ailleurs
}

export default function DashboardTopBar({ selectedEvent, onSelectEvent, toggleMobileSidebar }: DashboardTopBarProps) {
  const { session, user } = useAuth();
  const [events, setEvents] = useState<Array<{ id: string; name: string; icon?: string }>>([]);
  
  // 2. Restauration des states indispensables pour l'affichage et l'interaction
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  // 3. Restauration de la référence pour le menu déroulant
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!session?.access_token) return;

      // If user is staff, only show events where the user is already a member (validated)
      if (user?.role === 'staff') {
        try {
          const res = await fetch(`${API_URL}/my-applications`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.applications)) {
            const memberEvents = (data.applications || [])
              .filter((a: any) => a.status === 'valide' || a.status === 'validated' || a.status === 'approved')
              .map((a: any) => {
                const ev = a.events || {};
                return { id: ev.id, name: ev.title || ev.name || 'Événement sans nom', icon: 'event' };
              });
            setEvents(memberEvents);
          }
        } catch (err) {
          console.error('Erreur loading my-applications for staff topbar', err);
        }
        return;
      }

      // Non-staff: list all org events as before
      const orgRes = await authAPI.getMyOrganization(session.access_token);
      if (!orgRes.success || !orgRes.organization) return;
      const evRes = await authAPI.getEvents(orgRes.organization.id, session.access_token);
      if (!evRes.success) return;
      const mapped = (evRes.events || []).map((e: any) => ({ id: e.id, name: e.title || e.name || 'Événement sans nom', icon: 'event' }));
      setEvents(mapped);
    };
    load();
  }, [session]);

  // Fermer le menu déroulant si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed left-0 right-0 top-0 bg-surface-container-lowest border-b border-outline-variant/30 px-4 py-3 flex items-center justify-between gap-md shadow-sm z-40">
      
      {/* SECTION GAUCHE : Hamburger Mobile + Sélecteur d'événement */}
      <div className="flex items-center gap-sm">
        {/* Bouton Hamburger visible uniquement sur mobile (md:hidden) */}
        <button 
          type="button"
          onClick={toggleMobileSidebar}
          className="md:hidden text-on-surface-variant hover:bg-surface-container rounded-lg p-1.5 flex items-center justify-center transition-colors focus:outline-none"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        {/* Sélecteur d'événement */}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-sm px-md py-sm bg-surface hover:bg-surface-container rounded-xl border border-outline-variant/50 transition-colors text-label-md font-medium text-on-surface"
          >
            <span className="material-symbols-outlined text-md text-primary">
              {selectedEvent?.icon || 'event'}
            </span>
            <span className="truncate max-w-[120px] sm:max-w-none">
              {selectedEvent?.name || 'Sélectionner un événement'}
            </span>
            <span className="material-symbols-outlined text-md text-on-surface-variant">
              arrow_drop_down
            </span>
          </button>
          
          {/* Menu déroulant des événements */}
          {open && (
            <div className="absolute left-0 mt-xs w-64 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg py-xs z-50 max-h-60 overflow-y-auto">
              {events.length === 0 ? (
                <div className="px-md py-sm text-body-md text-on-surface-variant italic">
                  Aucun événement disponible
                </div>
              ) : (
                events.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      onSelectEvent?.(e.id); // 4. Utilisation sécurisée de la prop avec l'opérateur de chaînage (?.)
                      setOpen(false);
                    }}
                    className={`w-full text-left px-md py-sm text-body-md hover:bg-surface-container transition-colors flex items-center gap-sm ${
                      selectedEvent?.name === e.name ? 'text-primary font-bold bg-surface-container-low' : 'text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-md">{e.icon || 'event'}</span>
                    <span className="truncate">{e.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION DROITE : Notifications, Paramètres et Profil */}
      <div className="flex items-center gap-md">
        <button type="button" className="hover:bg-surface-container rounded-full p-2 text-on-surface-variant transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        {/* settings button removed per UX request */}
        <div className="h-8 w-[1px] bg-outline-variant mx-sm"></div>
        <div className="flex items-center gap-sm">
          <button type="button" onClick={() => setProfileOpen(true)} className="hidden xl:block text-label-md font-medium text-on-surface text-left">
            {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Mon profil' : 'Mon profil'}
          </button>
          <button type="button" onClick={() => setProfileOpen(true)} className="h-10 w-10 rounded-full border border-outline-variant bg-surface flex items-center justify-center font-bold text-sm text-on-surface select-none">
            {user ? `${(user.first_name || '').charAt(0)}${(user.last_name || '').charAt(0)}`.toUpperCase() : '??'}
          </button>
        </div>
      </div>

      {/* Modale Profil restaurée */}
      {profileOpen && <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}