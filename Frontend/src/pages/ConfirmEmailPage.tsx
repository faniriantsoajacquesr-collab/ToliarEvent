import { useEffect, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { authAPI } from '../services/authAPI';

import AuthShell from '../components/AuthShell';
import { AuthCardSkeleton } from '../components/skeleton';



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
    <AuthShell title="Confirmation" subtitle="Validation de votre adresse e-mail">
      <AuthCardSkeleton />
    </AuthShell>
  );
}

