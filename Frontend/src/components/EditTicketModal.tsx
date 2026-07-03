import { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';


interface EditTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string | null; // This will now be the full UUID
  eventId?: string | null;
  onSave: () => void; // Callback to refresh tickets after save
}

export default function EditTicketModal({ isOpen, onClose, ticketId, eventId, onSave }: EditTicketModalProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    holder_name: '',
    ticket_type: 'standard',
    price: 0,
    status: 'valid',
  });
  const [isLoading, setIsLoading] = useState(false);
  // originalTicket removed: not read elsewhere

  useEffect(() => {
    if (isOpen && ticketId && session?.access_token) {
      if (!eventId) {
        showToast('Impossible de charger le billet: événement non sélectionné.', 'error');
        onClose();
        return;
      }
      setIsLoading(true);
      fetch(`${API_URL}/tickets?event_id=${encodeURIComponent(String(eventId))}&search=${ticketId.replace('#', '')}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.ticket) {
            const ticket = data.ticket;
            setFormData({
              holder_name: ticket.holder_name || '',
              ticket_type: ticket.ticket_type || 'standard',
              price: ticket.price || 0,
              status: (ticket.status === 'valide' ? 'valid' : ticket.status) || 'valid',
            });
          } else {
            showToast(data.error || 'Billet introuvable pour édition.', 'error');
            onClose();
          }
        })
        .catch(err => {
          console.error('Error fetching ticket for edit:', err);
          showToast('Erreur lors du chargement du billet.', 'error');
          onClose();
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, ticketId, session, showToast, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !session?.access_token) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}`, { // Use the specific ticket endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Billet mis à jour avec succès.', 'success');
        onSave();
        onClose();
      } else {
        showToast(data.error || 'Erreur lors de la mise à jour du billet.', 'error');
      }
    } catch (err) {
      console.error('Error updating ticket:', err);
      showToast('Impossible de contacter le serveur pour la mise à jour.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-lg mb-4">Modifier le billet {ticketId}</h3>
        {isLoading ? (
          <div className="text-center py-8">Chargement des détails du billet...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="holder_name" className="block text-sm font-medium text-gray-700">Nom du détenteur</label>
              <input type="text" name="holder_name" id="holder_name" value={formData.holder_name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div>
              <label htmlFor="ticket_type" className="block text-sm font-medium text-gray-700">Type de billet</label>
              <select name="ticket_type" id="ticket_type" value={formData.ticket_type} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                <option value="standard">Standard</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">Prix</label>
              <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Statut</label>
              <select name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                <option value="valid">Valide</option>
                <option value="vendu">Vendu</option>
                <option value="utilisé">Utilisé</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">Annuler</button>
              <button type="submit" disabled={isLoading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">{isLoading ? 'Sauvegarde...' : 'Sauvegarder'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}