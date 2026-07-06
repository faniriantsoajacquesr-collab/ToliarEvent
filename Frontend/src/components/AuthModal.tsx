import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LegalAcceptanceCheckbox from './LegalAcceptanceCheckbox';
import PasswordInput from './PasswordInput';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState('');

  const { login, signup, isLoading, error: authError, authModalMode } = useAuth();
  const navigate = useNavigate();

  // Réinitialiser les messages quand la modal change de mode ou s'ouvre/se ferme
  useEffect(() => {
    setLocalError(null);
    setSuccessMessage(null);
    setAcceptedTerms(false);
    setTermsError('');
  }, [isOpen, isLogin]);

  useEffect(() => {
    if (isOpen) {
      setIsLogin(authModalMode === 'login');
    }
  }, [isOpen, authModalMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (!isLogin && password !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!isLogin && !acceptedTerms) {
      setTermsError('Vous devez accepter la politique de confidentialité et les CGU.');
      return;
    }

    try {
      if (isLogin) {
        const entryPath = await login(email, password);
        onClose();
        navigate(entryPath);
      } else {
        await signup(email, password);
        setSuccessMessage(
          `Un e-mail de vérification a été envoyé à ${email}. Vérifiez votre boîte de réception et le dossier SPAM, puis cliquez sur le lien de vérification.`
        );
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      // L'erreur est gérée par le contexte mais on peut l'intercepter ici
      setLocalError(err.message || 'Une erreur est survenue');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-gutter">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-xl animate-in zoom-in-95 duration-200">
        <button
          className="absolute top-md right-md text-on-surface-variant hover:text-on-surface"
          onClick={onClose}
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="text-center mb-xl">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-md">
            <span className="material-symbols-outlined text-[32px]">
              {isLogin ? 'lock' : 'person_add'}
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md mb-xs">
            {isLogin ? 'Se connecter' : 'Créer un compte'}
          </h3>
          <p className="text-on-surface-variant text-sm">
            {isLogin
              ? 'Connectez-vous pour accéder à votre tableau de bord'
              : 'Créez un compte pour commencer'}
          </p>
        </div>

        {/* Messages d'erreur et de succès */}
        {(localError || authError) && (
          <div className="mb-md p-sm bg-error-container text-on-error-container text-xs rounded-lg border border-error/20 flex items-center gap-xs">
            <span className="material-symbols-outlined text-sm">error</span>
            {localError || authError}
          </div>
        )}

        {successMessage && (
          <div className="mb-md p-sm bg-green-50 text-green-700 text-xs rounded-lg border border-green-200 flex items-center gap-xs">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-md">
          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface-variant ml-xs">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
              placeholder="votre.email@exemple.com"
              required
            />
          </div>

          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface-variant ml-xs">
              Mot de passe
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {!isLogin && (
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">
                Confirmer le mot de passe
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {!isLogin && (
            <LegalAcceptanceCheckbox
              id="auth-modal-legal-acceptance"
              checked={acceptedTerms}
              onChange={(checked) => {
                setAcceptedTerms(checked);
                if (checked) setTermsError('');
              }}
              error={termsError}
              openLinksInNewTab
            />
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-on-primary py-md rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-sm"
          >
            {isLoading && <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />}
            {isLogin ? 'Se connecter' : 'Créer un compte'}
          </button>
        </form>

        <p className="text-xs text-center text-on-surface-variant mt-lg">
          {isLogin ? "Pas encore de compte ? " : "Vous avez déjà un compte ? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setEmail('');
              setPassword('');
              setConfirmPassword('');
            }}
            className="text-primary underline hover:text-primary/80 font-medium transition-colors"
          >
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}
