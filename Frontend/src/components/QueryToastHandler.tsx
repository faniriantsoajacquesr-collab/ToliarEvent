import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export default function QueryToastHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  useEffect(() => {
    if (searchParams.get('email_confirmed') === '1') {
      showToast('Votre e-mail a été confirmé avec succès. Veuillez vous connecter.');
      const next = new URLSearchParams(searchParams);
      next.delete('email_confirmed');
      setSearchParams(next, { replace: true });
      return;
    }

    if (searchParams.get('email_confirm_error') === '1') {
      showToast('Le lien de confirmation est invalide ou a expiré.', 'error');
      const next = new URLSearchParams(searchParams);
      next.delete('email_confirm_error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast]);

  return null;
}
