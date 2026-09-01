import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { authAPI } from '../services/authAPI';

import { useAuth } from '../contexts/AuthContext';

import { resolveAppEntryPath } from '../utils/appRouting';

import AuthShell from '../components/AuthShell';

import OnboardingLayout from '../components/OnboardingLayout';



export default function OrganizationChoicePage() {

  const navigate = useNavigate();

  const { checkProfileCompletion, hasOrganization, organizationStatus } = useAuth();

  const [mode, setMode] = useState<'create' | 'join' | null>(null);

  const [orgName, setOrgName] = useState('');

  const [joinCode, setJoinCode] = useState('');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');



  const accessToken = localStorage.getItem('access_token') || '';



  useEffect(() => {

    if (hasOrganization) {

      navigate(resolveAppEntryPath({

        hasProfile: true,

        hasOrganization: true,

        organizationStatus,

      }), { replace: true });

    }

  }, [hasOrganization, organizationStatus, navigate]);



  const handleCreate = async () => {

    setError('');

    if (!orgName || orgName.trim().length < 2) return setError('Nom d\'organisation requis');

    setLoading(true);

    const res = await authAPI.createOrganization(orgName.trim(), accessToken);

    setLoading(false);

    if (!res.success) return setError(res.error || 'Erreur lors de la création');

    const result = await checkProfileCompletion(accessToken);

    navigate(resolveAppEntryPath({ hasProfile: true, hasOrganization: true, organizationStatus: result.organizationStatus }), { replace: true });

  };



  const handleJoin = async () => {

    setError('');

    if (!joinCode || joinCode.trim().length === 0) return setError('Code requis');

    setLoading(true);

    const res = await authAPI.joinOrganization(joinCode.trim(), accessToken);

    setLoading(false);

    if (!res.success) return setError(res.error || 'Erreur lors de la demande');

    const result = await checkProfileCompletion(accessToken);

    navigate(resolveAppEntryPath({ hasProfile: true, hasOrganization: true, organizationStatus: result.organizationStatus }), { replace: true });

  };



  const choiceClass = (active: boolean) =>

    `p-5 rounded-xl border text-left transition-all ${

      active

        ? 'border-primary bg-primary/10 shadow-sm'

        : 'border-[var(--landing-border)] hover:border-[var(--landing-border-strong)] bg-[var(--landing-glass-bg)]'

    }`;



  return (

    <OnboardingLayout>

      <AuthShell wide title="Votre organisation" subtitle="Créez ou rejoignez une organisation pour accéder au SaaS">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          <button type="button" onClick={() => setMode('create')} className={choiceClass(mode === 'create')}>

            <div className="font-semibold landing-heading">Créer une organisation</div>

            <p className="landing-text-muted text-sm mt-1">

              Vous serez admin. L&apos;organisation devra être validée avant l&apos;accès à la plateforme.

            </p>

          </button>



          <button type="button" onClick={() => setMode('join')} className={choiceClass(mode === 'join')}>

            <div className="font-semibold landing-heading">Rejoindre une organisation</div>

            <p className="landing-text-muted text-sm mt-1">

              Entrez le code d&apos;invitation fourni par l&apos;administrateur.

            </p>

          </button>

        </div>



        {mode === 'create' && (

          <div className="space-y-4">

            <div>

              <label className="app-label">Nom de l&apos;organisation</label>

              <input

                value={orgName}

                onChange={e => setOrgName(e.target.value)}

                className="app-input"

                placeholder="Association Otaku Toliara"

              />

            </div>

            <div className="flex gap-2">

              <button type="button" onClick={handleCreate} disabled={loading} className="landing-btn-primary !px-5 !py-2.5 !text-sm !rounded-xl">

                Créer

              </button>

              <button type="button" onClick={() => setMode(null)} className="landing-btn-secondary !px-5 !py-2.5 !text-sm !rounded-xl">

                Annuler

              </button>

            </div>

          </div>

        )}



        {mode === 'join' && (

          <div className="space-y-4">

            <div>

              <label className="app-label">Code d&apos;invitation</label>

              <input

                value={joinCode}

                onChange={e => setJoinCode(e.target.value)}

                className="app-input"

                placeholder="Entrez le code (ex: 123456)"

              />

            </div>

            <div className="flex gap-2">

              <button type="button" onClick={handleJoin} disabled={loading} className="landing-btn-primary !px-5 !py-2.5 !text-sm !rounded-xl">

                Envoyer la demande

              </button>

              <button type="button" onClick={() => setMode(null)} className="landing-btn-secondary !px-5 !py-2.5 !text-sm !rounded-xl">

                Annuler

              </button>

            </div>

          </div>

        )}



        {error && (

          <div className="mt-4 p-3 rounded-xl bg-error-container/80 border border-error text-on-error-container text-sm">

            {error}

          </div>

        )}

      </AuthShell>

    </OnboardingLayout>

  );

}

