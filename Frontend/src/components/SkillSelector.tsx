import { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

export interface Skill {
  id: number;
  name: string;
  event_id: string;
}

interface SkillSelectorProps {
  onSkillsChange: (selectedSkills: number[]) => void;
  selectedSkills?: number[];
  isLoading?: boolean;
}

export default function SkillSelector({
  onSkillsChange,
  selectedSkills = [],
  isLoading = false,
}: SkillSelectorProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<number[]>(selectedSkills);
  const [error, setError] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setFetchLoading(true);
      const accessToken = localStorage.getItem('access_token');
      
      const response = await fetch(`${API_URL}/skills`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Erreur lors du chargement des compétences');
        return;
      }

      setSkills(data.skills || []);
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
      console.error('Erreur fetch skills:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  const toggleSkill = (skillId: number) => {
    const newSelected = selected.includes(skillId)
      ? selected.filter(id => id !== skillId)
      : [...selected, skillId];
    
    setSelected(newSelected);
    onSkillsChange(newSelected);
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-outline-variant border-t-primary rounded-full animate-spin mx-auto mb-md"></div>
          <p className="text-label-md text-on-surface-variant">Chargement des compétences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-md bg-error-container rounded-lg border border-error text-on-error-container text-label-md">
        {error}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-md bg-surface-container rounded-lg text-center">
        <p className="text-label-md text-on-surface-variant">Aucune compétence disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <h3 className="text-headline-md font-bold text-on-surface">
          Sélectionnez vos compétences
        </h3>
        <span className="text-label-md text-on-surface-variant">
          {selected.length} / {skills.length}
        </span>
      </div>

      <p className="text-label-md text-on-surface-variant">
        Cliquez sur les compétences que vous maîtrisez
      </p>

      {/* Skills Grid - Pinterest Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-md auto-rows-max">
        {skills.map(skill => (
          <button
            key={skill.id}
            onClick={() => toggleSkill(skill.id)}
            disabled={isLoading}
            className={`
              p-md rounded-xl border-2 transition-all transform hover:scale-105
              active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              ${
                selected.includes(skill.id)
                  ? 'bg-primary border-primary text-on-primary shadow-md shadow-primary/30'
                  : 'bg-surface-container border-outline-variant text-on-surface hover:border-primary'
              }
            `}
          >
            <div className="flex flex-col items-center gap-xs">
              <span className="material-symbols-outlined text-2xl">
                {selected.includes(skill.id) ? 'check_circle' : 'circle'}
              </span>
              <span className="text-label-md font-semibold text-center line-clamp-2">
                {skill.name}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="mt-xl p-md bg-primary-container/20 rounded-lg border border-primary/30">
        <p className="text-label-md text-on-surface">
          <span className="font-semibold">Astuce:</span> Vous pourrez modifier votre sélection de compétences ultérieurement.
        </p>
      </div>
    </div>
  );
}
