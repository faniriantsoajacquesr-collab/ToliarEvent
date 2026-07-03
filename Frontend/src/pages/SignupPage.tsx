import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LegalAcceptanceCheckbox from '../components/LegalAcceptanceCheckbox';

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Tous les champs sont requis');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return false;
    }

    if (!acceptedTerms) {
      setTermsError('Vous devez accepter la politique de confidentialité et les CGU.');
      return false;
    }

    setTermsError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Erreur lors de l\'inscription');
        return;
      }

      setSuccess('Inscription réussie! Connexion en cours...');

      // Essayer de connecter automatiquement l'utilisateur
      try {
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });
        const loginData = await loginRes.json();

        if (loginData.success) {
          localStorage.setItem('access_token', loginData.session.access_token);
          localStorage.setItem('refresh_token', loginData.session.refresh_token);
          localStorage.setItem('user', JSON.stringify(loginData.user));

          // Rediriger vers la complétion du profil
          navigate('/complete-profile');
        } else {
          // Si login automatique échoue, renvoyer l'utilisateur vers la page de connexion
          setSuccess('Inscription réussie. Veuillez vous connecter.');
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (err) {
        console.error('Auto-login failed:', err);
        setSuccess('Inscription réussie. Veuillez vous connecter.');
        setTimeout(() => navigate('/login'), 2000);
      }
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
          <p className="text-label-md text-on-surface-variant">Créer un nouveau compte</p>
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
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Au moins 8 caractères"
              required
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-label-md font-semibold text-on-surface mb-sm">
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
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

          {/* Success Message */}
          {success && (
            <div className="p-md bg-success-container rounded-lg border border-success text-on-surface text-label-md">
              {success}
            </div>
          )}

          <LegalAcceptanceCheckbox
            id="signup-legal-acceptance"
            checked={acceptedTerms}
            onChange={(checked) => {
              setAcceptedTerms(checked);
              if (checked) setTermsError('');
            }}
            error={termsError}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white px-lg py-md rounded-lg font-semibold hover:bg-primary-container active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-xl text-center">
          <p className="text-label-md text-on-surface-variant">
            Déjà un compte?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
