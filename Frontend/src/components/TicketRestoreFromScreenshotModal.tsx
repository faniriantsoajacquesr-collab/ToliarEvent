import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { authAPI } from '../services/authAPI';
import { parseTicketScreenshot, type KnownTicketType, type ParsedTicketFromScreenshot } from '../utils/parseTicketScreenshot';

interface TicketRestoreFromScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  accessToken?: string;
  onRestored?: () => void;
}

export default function TicketRestoreFromScreenshotModal({
  isOpen,
  onClose,
  eventId,
  accessToken,
  onRestored,
}: TicketRestoreFromScreenshotModalProps) {
  const { showToast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [defaultPrice, setDefaultPrice] = useState('0');
  const [rows, setRows] = useState<ParsedTicketFromScreenshot[]>([]);
  const [ticketTypes, setTicketTypes] = useState<KnownTicketType[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const loadTicketTypes = async () => {
      if (!isOpen || !eventId || !accessToken) {
        setTicketTypes([]);
        return;
      }

      try {
        const response = await authAPI.getTicketTypes(eventId, accessToken);
        if (response.success && Array.isArray(response.ticket_types)) {
          setTicketTypes(
            response.ticket_types.map((type: { name: string; price?: number }) => ({
              name: type.name,
              price: Number(type.price) || 0,
            }))
          );
        } else {
          setTicketTypes([]);
        }
      } catch {
        setTicketTypes([]);
      }
    };

    loadTicketTypes();
  }, [isOpen, eventId, accessToken]);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.enabled && row.number != null && row.ticket_type.trim()),
    [rows]
  );

  if (!isOpen) return null;

  const resetState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRows([]);
    setDefaultPrice('0');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setRows([]);
    setIsParsing(true);

    try {
      let types = ticketTypes;
      if (types.length === 0 && eventId && accessToken) {
        const response = await authAPI.getTicketTypes(eventId, accessToken);
        if (response.success && Array.isArray(response.ticket_types)) {
          types = response.ticket_types.map((type: { name: string; price?: number }) => ({
            name: type.name,
            price: Number(type.price) || 0,
          }));
          setTicketTypes(types);
        }
      }

      const parsed = await parseTicketScreenshot(file, Number(defaultPrice) || 0, types);
      setRows(parsed);
      showToast(`${parsed.length} billet(s) détecté(s) dans l'image`, 'success');
    } catch (error) {
      console.error('parseTicketScreenshot failed', error);
      showToast(error instanceof Error ? error.message : 'Analyse de l\'image impossible', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ParsedTicketFromScreenshot>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleRestore = async () => {
    if (!eventId || !accessToken) {
      showToast('Événement ou session manquant', 'error');
      return;
    }
    if (selectedRows.length === 0) {
      showToast('Aucun billet valide à ré-enregistrer', 'error');
      return;
    }

    setIsRestoring(true);
    try {
      const response = await authAPI.restorePrintedTickets(
        eventId,
        selectedRows.map((row) => ({
          id: row.id,
          number: row.number as number,
          ticket_type: row.ticket_type.trim(),
          price: row.price,
        })),
        accessToken
      );

      if (!response.success) {
        showToast(response.error || 'Ré-enregistrement impossible', 'error');
        return;
      }

      const restoredCount = response.restored_count ?? response.restored?.length ?? 0;
      const skippedCount = response.skipped_count ?? response.skipped?.length ?? 0;
      showToast(
        `${restoredCount} billet(s) ré-enregistré(s)${skippedCount ? `, ${skippedCount} déjà présent(s)` : ''}.`,
        'success'
      );
      onRestored?.();
      handleClose();
    } catch (error) {
      console.error('restorePrintedTickets failed', error);
      showToast('Erreur réseau lors du ré-enregistrement', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Ré-enregistrer des billets imprimés</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Admin uniquement — importez une capture d&apos;écran contenant les QR codes et numéros de billets supprimés par erreur.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="text-sm text-on-surface-variant hover:text-on-surface">
            Fermer
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Capture d&apos;écran (PNG/JPG)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={isParsing || isRestoring}
              className="rounded-lg border border-outline-variant/50 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Prix par défaut (Ar)
            <input
              type="number"
              min="0"
              step="100"
              value={defaultPrice}
              onChange={(event) => setDefaultPrice(event.target.value)}
              className="rounded-lg border border-outline-variant/50 px-3 py-2"
            />
          </label>
        </div>

        {previewUrl ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low">
            <img src={previewUrl} alt="Capture des billets" className="max-h-72 w-full object-contain" />
          </div>
        ) : null}

        {isParsing ? <p className="mt-4 text-sm text-primary">Analyse des QR codes et des numéros…</p> : null}

        {rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2">Inclure</th>
                  <th className="px-3 py-2">N°</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Prix</th>
                  <th className="px-3 py-2">ID billet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-outline-variant/20">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={row.number ?? ''}
                        onChange={(event) => updateRow(row.id, { number: event.target.value ? Number(event.target.value) : null })}
                        className="w-24 rounded border border-outline-variant/40 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {ticketTypes.length > 0 ? (
                        <select
                          value={row.ticket_type || ticketTypes[0]?.name || ''}
                          onChange={(event) => {
                            const selected = ticketTypes.find((type) => type.name === event.target.value);
                            updateRow(row.id, {
                              ticket_type: event.target.value,
                              price: selected?.price ?? row.price,
                            });
                          }}
                          className="w-full min-w-[140px] rounded border border-outline-variant/40 px-2 py-1"
                        >
                          {!ticketTypes.some((type) => type.name === row.ticket_type) && row.ticket_type ? (
                            <option value={row.ticket_type}>{row.ticket_type} (détecté)</option>
                          ) : null}
                          {ticketTypes.map((type) => (
                            <option key={type.name} value={type.name}>{type.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={row.ticket_type}
                          onChange={(event) => updateRow(row.id, { ticket_type: event.target.value })}
                          className="w-full min-w-[120px] rounded border border-outline-variant/40 px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={row.price}
                        onChange={(event) => updateRow(row.id, { price: Number(event.target.value) || 0 })}
                        className="w-28 rounded border border-outline-variant/40 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-on-surface-variant">{row.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface-variant"
            disabled={isRestoring}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={isRestoring || selectedRows.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isRestoring ? 'Ré-enregistrement…' : `Ré-enregistrer ${selectedRows.length} billet(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
