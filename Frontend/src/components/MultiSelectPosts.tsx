import { useState, useEffect } from 'react';

export const defaultPosts = [
  // --- ÉQUIPE DE DIRECTION & MANAGEMENT ---
  'Directeur de Projet',
  'Coordonnateur Général',
  'Responsable Logistique',
  'Responsable Communication',
  'Responsable Partenariat & Sponsoring',
  
  // --- TECHNIQUE & PRODUCTION ---
  'Régisseur Général',
  'Technicien Son',
  'Technicien Lumière',
  'Caster / Commentateur',
  'Arbitre / Juge',
  
  // --- TERRAIN & LOGISTIQUE ---
  'Staff Accueil',
  'Caissier / Billetterie',
  'Logistique / Manutention',
  'Photographe / Vidéaste'
];

interface RequiredPost { name: string; slots_needed: number }

interface MultiSelectPostsProps {
  value: RequiredPost[];
  onChange: (v: RequiredPost[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}

export default function MultiSelectPosts({ value, onChange, suggestions = [], disabled = false }: MultiSelectPostsProps) {
  const [selected, setSelected] = useState<RequiredPost[]>(value || []);
  const [openSearch, setOpenSearch] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => setSelected(value || []), [value]);
  useEffect(() => onChange(selected), [selected]);

  const merged = Array.from(new Set([...(suggestions || []), ...defaultPosts]));
  const available = merged.filter(s => !selected.find(p => p.name.toLowerCase() === s.toLowerCase()));
  const filtered = available.filter(s => s.toLowerCase().includes(search.toLowerCase()));

  const add = (name: string) => {
    if (disabled) return;
    if (!name.trim()) return;
    if (selected.find(p => p.name.toLowerCase() === name.toLowerCase())) return;
    setSelected([...selected, { name: name.trim(), slots_needed: 1 }]);
    setSearch('');
    setOpenSearch(false);
  };

  const removeAt = (idx: number) => setSelected(selected.filter((_, i) => i !== idx));
  const inc = (idx: number) => setSelected(selected.map((p, i) => i === idx ? { ...p, slots_needed: p.slots_needed + 1 } : p));
  const dec = (idx: number) => setSelected(selected.map((p, i) => i === idx ? { ...p, slots_needed: Math.max(1, p.slots_needed - 1) } : p));

  return (
    <div className="space-y-md p-md bg-surface-container-lowest border border-outline-variant rounded-2xl relative">
      <div className="flex justify-between items-center">
        <h3 className="text-label-lg font-bold">Postes requis (Staff)</h3>
      </div>

      <div className="flex flex-wrap gap-sm">
        {selected.length === 0 && (
          <div className="text-on-surface-variant">Aucun poste sélectionné</div>
        )}
        {selected.map((post, idx) => (
          <div key={`${post.name}-${idx}`} className="flex items-center gap-sm bg-primary/10 text-primary px-sm py-xs rounded-lg group">
            <span className="font-bold text-xs uppercase">{post.name}</span>
            <div className="flex items-center bg-white/50 rounded px-1 text-xs">
              <button type="button" onClick={() => dec(idx)} className="px-2">-</button>
              <span className="mx-1 font-bold">x{post.slots_needed}</span>
              <button type="button" onClick={() => inc(idx)} className="px-2">+</button>
            </div>
            <button type="button" onClick={() => removeAt(idx)} className="material-symbols-outlined text-sm">close</button>
          </div>
        ))}
      </div>

      <div className="mt-sm">
        <div className="p-sm bg-surface-container rounded-xl">
          <h4 className="text-label-sm font-bold mb-xs">Choix disponibles</h4>
          <div className="flex flex-wrap gap-2">
            {available.slice(0, 100).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="px-sm py-xs bg-surface-variant hover:bg-surface-container rounded-full text-sm"
                disabled={disabled}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-4 bottom-4">
        <div className="relative">
          <button type="button" onClick={() => setOpenSearch(!openSearch)} className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center">+</button>
          {openSearch && (
            <div className="absolute right-0 bottom-12 w-80 bg-white border border-outline-variant shadow-xl rounded-xl z-10 p-sm">
              <input autoFocus className="w-full border-b border-outline-variant px-sm py-xs outline-none mb-sm" placeholder="Chercher ou créer..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(search); } }} />
              <div className="max-h-40 overflow-y-auto">
                {filtered.length === 0 && search.trim() && (
                  <button type="button" onClick={() => add(search)} className="w-full text-left px-sm py-xs hover:bg-primary/5 text-primary rounded-lg text-sm font-medium">+ Créer "{search}"</button>
                )}
                {filtered.map(s => (
                  <button key={s} type="button" onClick={() => add(s)} className="w-full text-left px-sm py-xs hover:bg-surface-container rounded-lg text-sm">{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { RequiredPost };
