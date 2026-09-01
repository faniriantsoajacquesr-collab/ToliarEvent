import { useState } from 'react';

import { Link } from 'react-router-dom';

import { API_URL } from '../config/api';

import AuthShell from '../components/AuthShell';

import LegalAcceptanceCheckbox from '../components/LegalAcceptanceCheckbox';

import PasswordInput from '../components/PasswordInput';



interface SignupFormData {

  email: string;

  password: string;

  confirmPassword: string;

}



export default function SignupPage() {

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

      const response = await fetch(`${API_URL}/signup`, {

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



      setSuccess(

        `Un e-mail de vérification a été envoyé à ${formData.email}. Vérifiez votre boîte de réception et le dossier SPAM, puis cliquez sur le lien de vérification.`

      );

    } catch (err) {

      setError('Erreur serveur. Veuillez réessayer.');

      console.error(err);

    } finally {

      setIsLoading(false);

    }

  };



  return (

    <AuthShell

      title="Créer un compte"

      subtitle="Rejoignez la plateforme ToliarEvent"

      footer={

        <p className="text-center landing-text-muted text-sm">

          Déjà un compte?{' '}

          <Link to="/login" className="text-primary font-semibold hover:underline">

            Se connecter

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

            placeholder="Au moins 8 caractères"

            required

            className="app-input"

          />

        </div>



        <div>

          <label htmlFor="confirmPassword" className="app-label">Confirmer le mot de passe</label>

          <PasswordInput

            id="confirmPassword"

            name="confirmPassword"

            value={formData.confirmPassword}

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



        {success && (

          <div className="p-3 rounded-xl bg-success-container/80 border border-success text-sm landing-heading">

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



        <button

          type="submit"

          disabled={isLoading}

          className="w-full landing-btn-primary !rounded-xl justify-center disabled:opacity-50 disabled:cursor-not-allowed"

        >

          {isLoading ? 'Inscription...' : 'S\'inscrire'}

        </button>

      </form>

    </AuthShell>

  );

}

