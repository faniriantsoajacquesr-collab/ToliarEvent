import { useState } from 'react';

import { useNavigate, Link } from 'react-router-dom';

import { API_URL } from '../config/api';

import { authAPI } from '../services/authAPI';

import { resolveAppEntryPath } from '../utils/appRouting';

import AuthShell from '../components/AuthShell';

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

    <AuthShell

      title="Connexion"

      subtitle="Accédez à votre espace organisateur"

      footer={

        <p className="text-center landing-text-muted text-sm">

          Pas encore de compte?{' '}

          <Link to="/signup" className="text-primary font-semibold hover:underline">

            S&apos;inscrire

          </Link>

        </p>

      }

    >

      <form onSubmit={handleSubmit} className="space-y-5">

        <div>

          <label htmlFor="email" className="app-label">Email</label>

          <input

            id="email"

            type="email"

            name="email"

            value={formData.email}

            onChange={handleInputChange}

            placeholder="vous@exemple.com"

            required

            className="app-input"

          />

        </div>



        <div>

          <label htmlFor="password" className="app-label">Mot de passe</label>

          <PasswordInput

            id="password"

            name="password"

            value={formData.password}

            onChange={handleInputChange}

            placeholder="••••••••"

            required

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

          {isLoading ? 'Connexion...' : 'Se connecter'}

        </button>

      </form>

    </AuthShell>

  );

}

