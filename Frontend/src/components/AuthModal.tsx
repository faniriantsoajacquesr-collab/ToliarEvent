import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LegalAcceptanceCheckbox from './LegalAcceptanceCheckbox';
import PasswordInput from './PasswordInput';
import EarlyAccessNotice from './EarlyAccessNotice';

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

  if (!isLogin) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-gutter" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="early-access-title" className="relative bg-surface w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl shadow-2xl p-xl">
        <button type="button" autoFocus aria-label="Fermer" onClick={onClose} className="absolute top-3 right-3 min-h-11 min-w-11 text-on-surface"><span className="material-symbols-outlined" aria-hidden="true">close</span></button>
        <h2 id="early-access-title" className="shrink-0 text-2xl font-semibold text-on-surface mb-6 pr-10">Demander un accès à ToliarEvent Pro</h2>
        <div className="early-access-scroll min-h-0 overflow-y-auto pr-3">
        <EarlyAccessNotice />
        <button type="button" onClick={() => setIsLogin(true)} className="mt-6 min-h-11 text-primary underline">Vous avez déjà vos logins ? Se connecter</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-gutter">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div role="dialog" aria-modal="true" aria-labelledby="login-modal-title" className="relative bg-surface text-on-surface border border-outline-variant w-full max-w-md rounded-2xl shadow-2xl p-xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          aria-label="Fermer"
          className="absolute top-2 right-2 min-h-11 min-w-11 text-on-surface-variant hover:text-on-surface"
          onClick={onClose}
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="text-center mb-xl">
          <div className="w-16 h-16 bg-primary/10 text-primary dark:bg-blue-400/10 dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-md">
            <span className="material-symbols-outlined text-[32px]">
              {isLogin ? 'lock' : 'person_add'}
            </span>
          </div>
          <h3 id="login-modal-title" className="font-headline-md text-headline-md text-on-surface mb-xs">
            {isLogin ? 'Se connecter' : 'Demander un accès'}
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
            <label htmlFor="login-modal-email" className="font-label-md text-label-md text-on-surface-variant ml-xs">
              Email
            </label>
            <input
              id="login-modal-email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
              placeholder="votre.email@exemple.com"
              required
            />
          </div>

          <div className="space-y-xs">
            <label htmlFor="login-modal-password" className="font-label-md text-label-md text-on-surface-variant ml-xs">
              Mot de passe
            </label>
            <PasswordInput
              id="login-modal-password"
              autoComplete="current-password"
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
            {isLogin ? 'Se connecter' : 'Demander un accès'}
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
            className="text-primary dark:text-blue-300 underline hover:text-primary/80 dark:hover:text-blue-200 font-medium transition-colors"
          >
            {isLogin ? "Demander un accès" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}
