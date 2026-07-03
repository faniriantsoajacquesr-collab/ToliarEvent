import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import { useToast } from '../contexts/ToastContext';
import { User, ShieldCheck, ChevronRight, ChevronLeft, Save, X, Plus } from 'lucide-react';

// Interface pour typer correctement les compétences système
interface SystemSkill {
  id: number;
  name: string;
}

export default function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { session, checkProfileCompletion } = useAuth();
  const { showToast } = useToast();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Étape 1 : Informations personnelles
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Étape 2 : Compétences
  const [availableSkills, setAvailableSkills] = useState<SystemSkill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [newCustomSkill, setNewCustomSkill] = useState('');

  // Chargement initial des données
  useEffect(() => {
    if (!isOpen) {
      setStep(1); // Réinitialiser à l'étape 1 à chaque réouverture
      return;
    }
    
    const loadProfileData = async () => {
      if (!session?.access_token) return;
      setLoading(true);
      try {
        // 1. Récupération du profil de l'utilisateur
        const res = await authAPI.checkProfile(session.access_token);
        if (res.success) {
          setProfile(res.profile || null);
          setFirstName(res.profile?.first_name || '');
          setLastName(res.profile?.last_name || '');
          setPhone(res.profile?.phone || '');
          
          // Récupérer les compétences déjà associées
          setSelectedSkillIds(res.profile?.skills?.map((s: any) => s.id) || []);
          setCustomSkills(res.profile?.custom_skills || []);
        }

        // 2. Récupération de la liste globale des compétences disponibles
        const skillsRes = await authAPI.getSkills(session.access_token);
        if (skillsRes.success) {
          setAvailableSkills(skillsRes.skills || []);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err);
        if (showToast) showToast('Erreur lors de la récupération des données du profil', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [isOpen, session, showToast]);

  // Gestion des compétences personnalisées (Custom Skills)
  const addCustomSkill = () => {
    const cleanSkill = newCustomSkill.trim();
    if (!cleanSkill) return;
    if (customSkills.includes(cleanSkill)) {
      setNewCustomSkill('');
      return;
    }
    setCustomSkills([...customSkills, cleanSkill]);
    setNewCustomSkill('');
  };

  const removeCustomSkill = (skillToRemove: string) => {
    setCustomSkills(customSkills.filter((s: string) => s !== skillToRemove));
  };

  // Basculer la sélection d'une compétence système
  const toggleSkillId = (id: number) => {
    if (selectedSkillIds.includes(id)) {
      setSelectedSkillIds(selectedSkillIds.filter((sid: number) => sid !== id));
    } else {
      setSelectedSkillIds([...selectedSkillIds, id]);
    }
  };

  // Sauvegarde finale via l'API
  const handleSaveProfile = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        skill_ids: selectedSkillIds,
        custom_skills: customSkills
      };

      const res = await authAPI.createProfile(payload, session.access_token);
      
      if (res.success) {
        if (showToast) showToast('Profil mis à jour avec succès !', 'success');
        await checkProfileCompletion(); // Notification au contexte Auth du changement
        onClose();
      } else {
        if (showToast) showToast(res.error || 'Erreur lors de la sauvegarde du profil', 'error');
      }
    } catch (err) {
      console.error('Erreur réseau lors de la mise à jour:', err);
      if (showToast) showToast('Une erreur réseau est survenue', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* En-tête du Modal */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Mettre à jour mon profil</h3>
            <p className="text-xs text-gray-500">Complétez vos informations pour continuer sur la plateforme</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de Progression (Stepper) */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-center gap-4 text-xs font-medium">
          <div className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${step === 1 ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>1</span>
            Informations personnelles
          </div>
          <div className="w-8 h-px bg-gray-200"></div>
          <div className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${step === 2 ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>2</span>
            Compétences & Expériences
          </div>
        </div>

        {/* Contenu du Formulaire */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading && !profile ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-gray-500">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              Récupération de vos informations...
            </div>
          ) : step === 1 ? (
            /* ================= ÉTAPE 1 : INFOS DE BASE ================= */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 mb-2">
                <User className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-blue-800">Ces informations permettent aux organisateurs d'événements de vous identifier rapidement.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Faniriantsoa"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: R."
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Numéro de téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +261 34 00 000 00"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          ) : (
            /* ================= ÉTAPE 2 : SKILLS & COMPÉTENCES ================= */
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">Sélectionnez vos domaines d'expertise ou ajoutez des compétences sur mesure en dessous.</p>
              </div>

              {/* Compétences Système */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Compétences Générales</label>
                <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50 custom-scrollbar">
                  {availableSkills.map((skill: SystemSkill) => {
                    const isSelected = selectedSkillIds.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkillId(skill.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {skill.name}
                        {isSelected && <X className="w-3 h-3 ml-0.5 opacity-80" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compétences sur mesure / custom skills */}
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Compétences sur mesure</label>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCustomSkill}
                    onChange={(e) => setNewCustomSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                    placeholder="Ex: React Native, UI/UX, Design de logos..."
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    className="px-3 bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.97] rounded-xl flex items-center justify-center transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Tags custom générés */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {customSkills.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">Aucune compétence sur mesure ajoutée.</span>
                  ) : (
                    customSkills.map((s: string) => (
                      <div
                        key={s}
                        className="px-3 py-1 bg-gray-100 text-gray-800 border border-gray-200 rounded-full flex items-center gap-1.5 text-xs font-medium"
                      >
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => removeCustomSkill(s)}
                          className="text-gray-400 hover:text-red-500 rounded-full transition-colors focus:outline-none"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barre d'Actions de Navigation (Footer) */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
            >
              Annuler
            </button>
            
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1 px-4 py-2 text-sm font-bold bg-primary text-white hover:bg-primary-container active:scale-[0.98] rounded-xl shadow-sm transition-all"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}