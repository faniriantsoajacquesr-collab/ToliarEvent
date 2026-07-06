import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config/api';
import { authAPI } from '../services/authAPI';
import { resolveAppEntryPath } from '../utils/appRouting';
import PasswordInput from '../components/PasswordInput';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Erreur de connexion');
        return;
      }

      // Stocker les tokens et les infos utilisateur
      localStorage.setItem('access_token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      const profile = await authAPI.checkProfile(data.session.access_token);
      navigate(resolveAppEntryPath({
        hasProfile: profile.hasProfile,
        hasOrganization: profile.hasOrganization,
        organizationStatus: profile.organizationStatus || null,
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
          <h1 className="text-headline-md font-bold text-primary mb-sm">ToliarEvent</h1>
          <p className="text-label-md text-on-surface-variant">Connexion à votre compte</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-lg">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-label-md font-semibold text-on-surface mb-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="vous@exemple.com"
              required
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-label-md font-semibold text-on-surface mb-sm">
              Mot de passe
            </label>
            <PasswordInput
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
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
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-xl text-center">
          <p className="text-label-md text-on-surface-variant">
            Pas encore de compte?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
