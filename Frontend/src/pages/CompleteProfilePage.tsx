import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/authAPI';
import { useAuth } from '../contexts/AuthContext';
import { resolveAppEntryPath } from '../utils/appRouting';

interface ProfileFormData {
  first_name: string;
  last_name: string;
  phone: string;
}

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { checkProfileCompletion } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Récupérer l'utilisateur depuis localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.first_name || !formData.last_name) {
      setError('Prénom et nom sont requis');
      return false;
    }

    if (formData.first_name.length < 2) {
      setError('Le prénom doit contenir au moins 2 caractères');
      return false;
    }

    if (formData.last_name.length < 2) {
      setError('Le nom doit contenir au moins 2 caractères');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        setError('Authentification requise');
        navigate('/login');
        return;
      }

      // Créer le profil utilisateur
      const profileData = await authAPI.createProfile(
        {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone || null,
        },
        accessToken
      );

      if (!profileData.success) {
        setError(profileData.error || 'Erreur lors de la création du profil');
        return;
      }

      // Mettre à jour le user dans localStorage avec les données du profil créé
      const updatedUser = {
        ...user,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Synchroniser l'état global (hasProfile / hasOrganization) avant la navigation
      const result = await checkProfileCompletion(accessToken);
      navigate(resolveAppEntryPath({
        hasProfile: true,
        hasOrganization: result.hasOrganization,
        organizationStatus: result.organizationStatus,
      }));
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-primary flex items-center justify-center p-md">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-lg p-xl border border-outline-variant">
        {/* Header */}
        <div className="text-center mb-xl">
          <h1 className="text-headline-md font-bold text-primary mb-sm">Compléter votre profil</h1>
          <p className="text-label-md text-on-surface-variant">
            Bienvenue {user?.email}!
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-lg">
          {/* First Name */}
          <div>
            <label htmlFor="first_name" className="block text-label-md font-semibold text-on-surface mb-sm">
              Prénom
            </label>
            <input
              id="first_name"
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              placeholder="Jean"
              required
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="last_name" className="block text-label-md font-semibold text-on-surface mb-sm">
              Nom
            </label>
            <input
              id="last_name"
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              placeholder="Dupont"
              required
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Phone (Optional) */}
          <div>
            <label htmlFor="phone" className="block text-label-md font-semibold text-on-surface mb-sm">
              Téléphone (optionnel)
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+261 XX XXX XXX"
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-md bg-error-container rounded-lg border border-error text-on-error-container text-label-md">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white px-lg py-md rounded-lg font-semibold hover:bg-primary-container active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enregistrement...' : 'Continuer'}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-xl p-md bg-primary-container/20 rounded-lg border border-primary/30">
          <p className="text-label-md text-on-surface">
            <span className="font-semibold">Note:</span> Ces informations peuvent être modifiées ultérieurement dans les paramètres de votre profil.
          </p>
        </div>
      </div>
    </div>
  );
}
