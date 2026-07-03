import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import EventModal from '../components/EventModal';
import LoadingOverlay from '../components/LoadingOverlay';

interface Post {
  id: string;
  name: string;
  slots_needed: number;
}

interface Event {
  id: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
  posts: Post[];
}

export default function EventsPage() {
  const { session, user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/events', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.success) setEvents(data.events);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) fetchEvents();
  }, [session]);

  const isAdmin = user?.role === 'admin';

  if (loading) return <LoadingOverlay message="Chargement des événements..." />;

  return (
    <div className="p-gutter max-w-container-max mx-auto mt-20">
      <div className="flex justify-between items-center mb-xl">
        <h1 className="text-headline-lg font-bold">Événements de l'organisation</h1>
        {isAdmin && (
          <button onClick={() => setIsModalOpen(true)} className="bg-primary text-on-primary px-lg py-md rounded-xl font-bold flex items-center gap-sm shadow-lg hover:scale-105 transition-all">
            <span className="material-symbols-outlined">add_circle</span> Nouvel événement
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="bg-surface-container-low rounded-3xl p-2xl text-center border border-dashed border-outline-variant">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-4xl">calendar_today</span>
          </div>
          <h2 className="text-headline-sm font-semibold mb-sm">Vous n'avez pas encore d'événement</h2>
          <p className="text-on-surface-variant mb-xl max-w-md mx-auto">
            Commencez par créer votre premier événement pour organiser votre staff et vos tâches.
          </p>
          {isAdmin && (
            <button onClick={() => setIsModalOpen(true)} className="bg-primary text-on-primary px-xl py-md rounded-xl font-bold">
              Créer un événement
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-2xl p-lg border border-outline-variant hover:shadow-md transition-shadow">
              <h3 className="text-headline-sm font-bold mb-xs">{event.title}</h3>
              <div className="flex items-center gap-sm text-on-surface-variant text-sm mb-md">
                <span className="material-symbols-outlined text-sm">location_on</span> {event.location}
              </div>
              <div className="flex flex-wrap gap-xs">
                {event.posts?.map(post => (
                  <span key={post.id} className="px-sm py-1 bg-surface-container text-on-surface text-[10px] font-bold rounded-full">
                    {post.name} {post.slots_needed > 1 && `x${post.slots_needed}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchEvents} />
    </div>
  );
}