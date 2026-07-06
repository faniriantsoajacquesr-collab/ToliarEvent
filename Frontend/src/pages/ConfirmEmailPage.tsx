import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/authAPI';

export default function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    const confirm = async () => {
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      if (tokenHash && type) {
        try {
          const data = await authAPI.confirmEmail(tokenHash, type);
          if (data.success) {
            navigate('/?email_confirmed=1', { replace: true });
            return;
          }
        } catch {
          // fall through to error state
        }
        setError(true);
        return;
      }

      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const hashType = params.get('type');
        if (accessToken && hashType) {
          navigate('/?email_confirmed=1', { replace: true });
          return;
        }
      }

      setError(true);
    };

    confirm();
  }, [navigate, searchParams]);

  useEffect(() => {
    if (error) {
      navigate('/?email_confirm_error=1', { replace: true });
    }
  }, [error, navigate]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-md text-on-surface-variant">
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm">Confirmation de votre e-mail en cours…</p>
      </div>
    </div>
  );
}
