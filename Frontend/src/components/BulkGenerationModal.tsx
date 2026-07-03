import { useState } from 'react';

interface BulkGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: BulkConfig) => void;
}

export interface BulkConfig {
  quantity: number;
  type: 'Standard' | 'VIP';
  price: string;
}

export default function BulkGenerationModal({
  isOpen,
  onClose,
  onGenerate,
}: BulkGenerationModalProps) {
  const [config, setConfig] = useState<BulkConfig>({
    quantity: 100,
    type: 'Standard',
    price: '50,000',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    // Simulate generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setIsGenerating(false);
    onGenerate(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-on-background/40 backdrop-blur-sm z-[100] flex items-center justify-center p-md"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden scale-95 transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-xl border-b border-outline-variant/30 flex items-center justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md">Génération en masse</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Configurez les paramètres du lot
            </p>
          </div>
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <form className="p-xl space-y-lg" onSubmit={handleSubmit}>
          <div className="space-y-base">
            <label className="block font-label-md text-label-md text-on-surface-variant">
              Nombre de billets
            </label>
            <input
              className="w-full px-md py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="Ex: 100"
              type="number"
              value={config.quantity}
              onChange={(e) =>
                setConfig({ ...config, quantity: parseInt(e.target.value) || 0 })
              }
              required
              min="1"
            />
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-base">
              <label className="block font-label-md text-label-md text-on-surface-variant">
                Type
              </label>
              <select
                className="w-full px-md py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                value={config.type}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    type: e.target.value as 'Standard' | 'VIP',
                  })
                }
              >
                <option>Standard</option>
                <option>VIP</option>
              </select>
            </div>
            <div className="space-y-base">
              <label className="block font-label-md text-label-md text-on-surface-variant">
                Prix unitaire (Ar)
              </label>
              <input
                className="w-full px-md py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Ex: 50,000"
                type="text"
                value={config.price}
                onChange={(e) => setConfig({ ...config, price: e.target.value })}
              />
            </div>
          </div>

          <div className="p-md bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-sm">
            <span className="material-symbols-outlined text-primary text-sm mt-0.5">
              info
            </span>
            <p className="text-[11px] leading-relaxed text-primary">
              Les billets seront générés avec des codes QR uniques. Vous recevrez
              un fichier ZIP contenant les billets individuels prêts à l'impression.
            </p>
          </div>

          <div className="pt-md flex gap-md">
            <button
              className="flex-1 px-md py-3 border border-outline-variant/50 rounded-xl font-label-md text-label-md hover:bg-surface-container transition-colors"
              onClick={onClose}
              type="button"
              disabled={isGenerating}
            >
              Annuler
            </button>
            <button
              className="flex-1 px-md py-3 bg-primary text-white rounded-xl font-label-md text-label-md shadow-lg shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-sm disabled:opacity-50"
              type="submit"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">
                    autorenew
                  </span>
                  <span>Génération...</span>
                </>
              ) : (
                <>
                  <span>Lancer la génération</span>
                  <span className="material-symbols-outlined text-sm">rocket_launch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
