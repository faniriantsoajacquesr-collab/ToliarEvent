import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/authAPI';
import { useAuth } from '../contexts/AuthContext';
import { resolveAppEntryPath } from '../utils/appRouting';
import AuthShell from '../components/AuthShell';
import OnboardingLayout from '../components/OnboardingLayout';

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
    <OnboardingLayout>
      <AuthShell
        title="Compléter votre profil"
        subtitle={user?.email ? `Bienvenue ${user.email}` : 'Quelques informations pour commencer'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="first_name" className="app-label">Prénom</label>
            <input
              id="first_name"
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              placeholder="Jean"
              required
              className="app-input"
            />
          </div>

          <div>
            <label htmlFor="last_name" className="app-label">Nom</label>
            <input
              id="last_name"
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              placeholder="Dupont"
              required
              className="app-input"
            />
          </div>

          <div>
            <label htmlFor="phone" className="app-label">Téléphone (optionnel)</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+261 XX XXX XXX"
              className="app-input"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-error-container/80 border border-error text-on-error-container text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full landing-btn-primary !rounded-xl justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enregistrement...' : 'Continuer'}
          </button>
        </form>

        <div className="mt-6 p-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-glass-bg)]">
          <p className="text-sm landing-text-muted">
            <span className="font-semibold landing-heading">Note:</span> Ces informations peuvent être modifiées ultérieurement dans les paramètres de votre profil.
          </p>
        </div>
      </AuthShell>
    </OnboardingLayout>
  );
}
