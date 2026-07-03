import { useState, useRef, useEffect } from 'react';
import { API_URL } from '../config/api';
import { authAPI } from '../services/authAPI';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Image as IconImage, RefreshCw, Layout, Edit, Sliders, AlertTriangle, Maximize2, Hash, Mail, Check, Download } from 'lucide-react';

type SupportType = 'ticket' | 'badge' | 'invitation';
type LayoutOption = '1_col' | '2_col' | '3_col' | 'custom';

type Config = {
  name: string;
  supportType: SupportType;
  layoutOption: LayoutOption;
  customDimensions: { width: number; height: number }; // mm
  qrPosition: 'front' | 'back';
  qrBg: 'white' | 'black';
  qrContainerMm?: number; // largeur du container QR en mm
  backgroundImage?: string | null;
  backgroundFile?: File | null;
  eventId?: string | null;
  backgroundColor: string;
  backText: string;
  activeTab: 'single' | 'sheet';
  rowGap: number; // en mm
  colGap: number; // en mm
};

const SHEET_PREVIEW_WIDTH_PX = 400;
const MM_TO_PX = SHEET_PREVIEW_WIDTH_PX / 210; // Mapping exact pour que les mm soient proportionnels aux 400px de l'aperçu
const DEFAULT_WIDTH = 85;
const DEFAULT_HEIGHT = 54;
const MIN_SAFE_ROW_HEIGHT_MM = 40; 
const SHEET_PREVIEW_HEIGHT_PX = Math.round(SHEET_PREVIEW_WIDTH_PX * 1.414); 
const MM_TO_PX_HEIGHT = SHEET_PREVIEW_HEIGHT_PX / 297;

export default function TicketBadgeEditor() {
  const { showToast } = useToast();
  const { session } = useAuth();

  const [config, setConfig] = useState<Config>({
    name: 'Invitation Spéciale',
    supportType: 'invitation',
    layoutOption: '1_col',
    customDimensions: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    qrPosition: 'front',
    backgroundImage: null,
    backgroundFile: null,
    backgroundColor: '#ffffff',
    backText: 'Règlement: présentation obligatoire à l’entrée.',
    activeTab: 'sheet',
    qrBg: 'white',
    qrContainerMm: 50,
    rowGap: 4, 
    colGap: 4,
  });

  const [flipped, setFlipped] = useState(false);
  const [imgPreviewUrl, setImgPreviewUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState<{ width: number; height: number } | null>(null);
  const [manualDimsEnabled, setManualDimsEnabled] = useState(false);
  
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ callback: () => void; heightMm: number } | null>(null);

  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (config.backgroundImage) setImgPreviewUrl(config.backgroundImage);
    else setImgPreviewUrl(null);
  }, [config.backgroundImage]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.files?.length) return;
      const f = e.dataTransfer.files[0];
      await handleFile(f);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    el.addEventListener('drop', onDrop as any);
    el.addEventListener('dragover', onDragOver as any);
    return () => {
      el.removeEventListener('drop', onDrop as any);
      el.removeEventListener('dragover', onDragOver as any);
    };
  }, [dropRef.current]);

  const toDataURL = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  async function compressImage(file: File, maxBytes = 500_000): Promise<Blob> {
    try {
      const dataUrl = await toDataURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = document.createElement('img') as HTMLImageElement;
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      const maxDim = Math.max(img.width, img.height);
      const scale = maxDim > 2000 ? 2000 / maxDim : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let quality = 0.92;
      for (let i = 0; i < 8; i++) {
        const blob: Blob | null = await new Promise((res) => canvas.toBlob(res as any, 'image/jpeg', quality));
        if (!blob) break;
        if (blob.size <= maxBytes) return blob;
        quality *= 0.8;
      }
      const fallback: Blob | null = await new Promise((res) => canvas.toBlob(res as any, 'image/jpeg', 0.5));
      return fallback || file;
    } catch (err) {
      return file;
    }
  }

  // Calcul des dimensions réelles en mm pour la règle de 3
  const getLiveDimensionsMm = (targetCols: number, supportType: SupportType, naturalSize: { width: number; height: number } | null) => {
    if (supportType === 'badge') {
      return { widthMm: 85, heightMm: 54 };
    }

    const AVAILABLE_WIDTH_PX = SHEET_PREVIEW_WIDTH_PX - 32; 
    const cGapPx = config.colGap * MM_TO_PX;
    const colWidthPx = (AVAILABLE_WIDTH_PX - (cGapPx * (targetCols - 1))) / targetCols;
    
    let rowHeightPx = colWidthPx * (54 / 85);
    
    if (naturalSize) {
      if (supportType === 'invitation') {
        // Le QR Code fait STRICTEMENT 50mm de large. L'image prend le reste de la colonne.
        const qrWidthPx = (config.qrContainerMm || 50) * MM_TO_PX;
        const imageWidthPx = Math.max(30, colWidthPx - qrWidthPx);
        const imageRatio = naturalSize.width / naturalSize.height;
        // La hauteur de la ligne dépend exclusivement de la mise à l'échelle de l'image
        rowHeightPx = imageWidthPx / imageRatio;
      } else {
        const imageRatio = naturalSize.width / naturalSize.height;
        rowHeightPx = colWidthPx / (imageRatio + 1);
      }
    }

    const widthMm = Math.round((colWidthPx * 210) / SHEET_PREVIEW_WIDTH_PX);
    const heightMm = Math.round((rowHeightPx * 297) / SHEET_PREVIEW_HEIGHT_PX);

    return { widthMm, heightMm };
  };

  const calculateRowHeightMm = (targetCols: number, supportType: SupportType, naturalSize: { width: number; height: number } | null) => {
    return getLiveDimensionsMm(targetCols, supportType, naturalSize).heightMm;
  };

  // Strict/predictive total count using the exact rendered ticket height
  const getLiveTotalCount = (targetCols: number, supportType: SupportType, naturalSize: { width: number; height: number } | null) => {
    const isBadge = supportType === 'badge';
    const AVAILABLE_WIDTH_PX = SHEET_PREVIEW_WIDTH_PX - 32;
    const AVAILABLE_HEIGHT_PX = SHEET_PREVIEW_HEIGHT_PX - 32;

    const rGapPx = config.rowGap * MM_TO_PX;
    const cGapPx = config.colGap * MM_TO_PX;

    const colWidthPx = (AVAILABLE_WIDTH_PX - (cGapPx * (targetCols - 1))) / targetCols;

    let rowHeightPx = colWidthPx * (54 / 85);

    if (manualDimsEnabled) {
      // FIX STRICT : Si le mode manuel est activé, la hauteur d'une ligne est définie 
      // soit directement par la dimension voulue, soit recalculée si un ratio image prend le dessus.
      const manualTotalColPx = config.customDimensions.width * MM_TO_PX;
      const maxPerCol = (AVAILABLE_WIDTH_PX - (cGapPx * (targetCols - 1))) / targetCols;
      const totalColPx = Math.min(manualTotalColPx, maxPerCol);
      
      const qrContainerPx = (config.qrContainerMm || 50) * MM_TO_PX;
      const imageWidthPx = Math.max(0, totalColPx - qrContainerPx);

      if (naturalSize) {
        rowHeightPx = imageWidthPx / (naturalSize.width / naturalSize.height);
      } else {
        rowHeightPx = config.customDimensions.height * MM_TO_PX_HEIGHT;
      }
    } else if (!isBadge && naturalSize) {
      if (supportType === 'invitation') {
        const qrWidthPx = (config.qrContainerMm || 50) * MM_TO_PX;
        const imageWidthPx = Math.max(30, colWidthPx - qrWidthPx);
        rowHeightPx = imageWidthPx / (naturalSize.width / naturalSize.height);
      } else {
        const imageWidthPx = colWidthPx / 2;
        rowHeightPx = imageWidthPx / (naturalSize.width / naturalSize.height);
      }
    }

    // On s'assure que la hauteur finale testée est STRICTEMENT identique à celle envoyée au style CSS
    const renderedTicketHeight = rowHeightPx;

    // Simulation précise ligne par ligne pour exclure les débordements
    let y = 0;
    let visibleRows = 0;
    const fullRowStep = renderedTicketHeight + rGapPx;

    while (y + renderedTicketHeight <= AVAILABLE_HEIGHT_PX + 0.5) { // Tolérance de 0.5px pour les arrondis subpixel
      visibleRows++;
      y += fullRowStep;
    }
    const rows = Math.max(1, visibleRows);

    const usedHeightPx = rows * renderedTicketHeight + (rows - 1) * rGapPx;
    const remainingHeightPx = AVAILABLE_HEIGHT_PX - usedHeightPx;

    return {
      rows,
      cols: targetCols,
      total: rows * targetCols,
      rowHeightPx: renderedTicketHeight, // Utilise la valeur nettoyée
      usedHeightPx,
      remainingHeightPx,
    } as const;
  };

  const checkHeightAndExecute = (targetCols: number, targetSupport: SupportType, naturalSize: { width: number; height: number } | null, action: () => void) => {
    if (targetSupport === 'badge') {
      action();
      return;
    }
    const estimatedHeightMm = calculateRowHeightMm(targetCols, targetSupport, naturalSize);
    if (estimatedHeightMm < MIN_SAFE_ROW_HEIGHT_MM) {
      setPendingAction({ callback: action, heightMm: estimatedHeightMm });
      setShowWarningModal(true);
    } else {
      action();
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Format non supporté. Utilisez une image.', 'error');
      return;
    }
    const compressed = await compressImage(file, 500_000);
    const url = URL.createObjectURL(compressed);
    const compFile = new File([compressed], (file.name || 'bg').replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    
    const imgEl = document.createElement('img');
    imgEl.onload = () => {
      const sizeObj = { width: imgEl.naturalWidth, height: imgEl.naturalHeight };
      
      checkHeightAndExecute(sheetCols, config.supportType, sizeObj, () => {
        setImgNatural(sizeObj);
        setConfig((c) => ({ ...c, backgroundImage: url, backgroundFile: compFile }));
        showToast('Image prête pour l’aperçu.', 'success');
      });
    };
    imgEl.src = url;
  };

  const handleLayoutChange = (newOption: LayoutOption) => {
    const targetCols = newOption === '1_col' ? 1 : newOption === '2_col' ? 2 : 3;
    checkHeightAndExecute(targetCols, config.supportType, imgNatural, () => {
      setConfig(c => ({ ...c, layoutOption: newOption }));
    });
  };

  const handleSupportTypeChange = (type: SupportType) => {
    const targetCols = type === 'ticket' ? 2 : type === 'invitation' ? 1 : 3;
    const targetPosition = type === 'ticket' || type === 'invitation' ? 'front' : 'back';
    checkHeightAndExecute(targetCols, type, imgNatural, () => {
      setConfig(c => ({ 
        ...c, 
        supportType: type, 
        layoutOption: type === 'ticket' ? '2_col' : type === 'invitation' ? '1_col' : '3_col', 
        qrPosition: targetPosition 
      }));
    });
  };

  // Modal + generation state
  const [modalOpen, setModalOpen] = useState(false);
  const [orgEvents, setOrgEvents] = useState<any[]>([]);
  const [selectedEventForGen, setSelectedEventForGen] = useState<string | null>(null);
  const [ticketPrice, setTicketPrice] = useState<number>(0); // New state for ticket price
  const [ticketCount, setTicketCount] = useState<number>(1);
  // Ticket types are loaded per-event; support dynamic custom types
  const [ticketTypes, setTicketTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [ticketType, setTicketType] = useState<string | null>('standard');
  const [addingTypeOpen, setAddingTypeOpen] = useState(false);
  const [newTicketTypeName, setNewTicketTypeName] = useState('');
  const [addingTypeLoading, setAddingTypeLoading] = useState(false);
  const [genPhase, setGenPhase] = useState<'idle'|'running'|'done'|'error'>('idle');
  const [genLog, setGenLog] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const sheetCols = config.layoutOption === '1_col' ? 1 : config.layoutOption === '2_col' ? 2 : 3;

  // Calcul des dimensions actuelles pour la précision du rendu backend
  const currentDims = manualDimsEnabled
    ? { widthMm: config.customDimensions.width, heightMm: config.customDimensions.height }
    : getLiveDimensionsMm(sheetCols, config.supportType, imgNatural);
  const layoutStats = getLiveTotalCount(sheetCols, config.supportType, imgNatural);
  const totalTicketsCount = layoutStats.total;

  const appendLog = (line: string) => setGenLog(l => [...l, line]);

  const handleOpenModal = async () => {
    // fetch org and events
    if (!session?.access_token) { showToast('Authentifiez-vous', 'error'); return; }
    const orgRes = await authAPI.getMyOrganization(session.access_token);
    if (!orgRes.success || !orgRes.organization) { showToast('Organisation introuvable', 'error'); return; }
    const evRes = await authAPI.getEvents(orgRes.organization.id, session.access_token);
    if (!evRes.success) { showToast('Impossible de récupérer vos événements', 'error'); return; }
    setOrgEvents(evRes.events || []);
    setSelectedEventForGen(orgRes.organization && evRes.events && evRes.events[0] ? evRes.events[0].id : null);
    setModalOpen(true);
    // fetch ticket types for initial selected event
    if (orgRes.organization && evRes.events && evRes.events[0]) {
      const initialEventId = evRes.events[0].id;
      try {
        const typesRes = await authAPI.getTicketTypes(initialEventId, session?.access_token || '');
        if (typesRes.success) setTicketTypes(typesRes.ticket_types || []);
      } catch (e) {
        console.warn('Failed to load ticket types', e);
      }
    }
  };

  const b64ToBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  const handleGenerate = async () => {
    if (!selectedEventForGen) { showToast('Sélectionnez un événement', 'error'); return; }
    if (!ticketCount || ticketCount <= 0) { showToast('Nombre de billets invalide', 'error'); return; }
    if (ticketPrice < 0) { showToast('Le prix du billet ne peut pas être négatif', 'error'); return; }
    
    setGenPhase('running');
    setGenLog([]);
    setPdfUrl(null);

    try {
      // Correction : Toujours extraire le Base64 depuis le fichier compressé
      let imageData: string | null = null;
      if (config.backgroundFile) {
        imageData = await toDataURL(config.backgroundFile);
      } else if (config.backgroundImage && config.backgroundImage.startsWith('data:')) {
        imageData = config.backgroundImage;
      }

      if (!imageData) {
        throw new Error("Design manquant. Veuillez charger une image avant de continuer.");
      }

      // Simulation visuelle des étapes pour le confort utilisateur
      appendLog('⋯ 1. Génération des UUID des billets…');
      await new Promise(r => setTimeout(r, 600));
      appendLog('⋯ 2. Génération des codes QR uniques…');
      await new Promise(r => setTimeout(r, 600));
      appendLog('⋯ 3. Génération du fichier PDF…');

      const payload = { 
        event_id: selectedEventForGen, 
        count: ticketCount, 
        ticket_type: ticketType, 
        price: ticketPrice, // Include ticket price in the payload
        design_image_data: imageData,
        config: {
          ...config,
          widthMm: currentDims.widthMm,
          heightMm: currentDims.heightMm
        } 
      };

      const res = await fetch(`${API_URL}/generate-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erreur de communication serveur' }));
        throw new Error(errData.error || `Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erreur serveur');

      const pdfBase64 = data.pdf_base64;
      const blob = b64ToBlob(pdfBase64, 'application/pdf');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setGenPhase('done');
      appendLog('✓ Billets générés avec succès !');
    } catch (err: any) {
      console.error(err);
      setGenPhase('error');
      appendLog('❌ Erreur: ' + (err?.message || 'Échec de la génération'));
      showToast('Erreur pendant la génération', 'error');
    }
  };

  // Fetch ticket types when selected event for generation changes
  useEffect(() => {
    const loadTypes = async () => {
      if (!selectedEventForGen || !session?.access_token) return;
      try {
        const typesRes = await authAPI.getTicketTypes(selectedEventForGen, session.access_token);
        if (typesRes.success) setTicketTypes(typesRes.ticket_types || []);
      } catch (e) {
        console.warn('Erreur chargement ticket types', e);
      }
    };
    loadTypes();
  }, [selectedEventForGen, session]);

  const addNewTicketType = async () => {
    if (!selectedEventForGen) { showToast('Choisissez d\'abord un événement', 'error'); return; }
    if (!newTicketTypeName.trim()) return;
    setAddingTypeLoading(true);
    try {
      const res = await authAPI.createTicketType(selectedEventForGen, newTicketTypeName.trim(), session?.access_token || '');
      if (res.success) {
        const created = res.ticket_type;
        setTicketTypes(prev => [...prev, created]);
        setTicketType(created.id || created.name);
        setNewTicketTypeName('');
        setAddingTypeOpen(false);
        showToast('Type de billet ajouté', 'success');
      } else {
        showToast(res.error || 'Impossible d\'ajouter le type', 'error');
      }
    } catch (e) {
      console.error('createTicketType failed', e);
      showToast('Erreur réseau lors de la création', 'error');
    } finally {
      setAddingTypeLoading(false);
    }
  };

  const getIdealDimensionsText = () => {
    if (config.supportType === 'ticket') {
      const AVAILABLE_A4_WIDTH_MM = 210 - 10; 
      const colWidthMm = Math.round((AVAILABLE_A4_WIDTH_MM - (config.colGap * (sheetCols - 1))) / sheetCols);
      return `Format Ticket Entry : Pour une impression en ${sheetCols} colonne(s), privilégiez un design d'au moins 4.0 cm de hauteur (Idéal : ${colWidthMm - 40}x40 mm).`;
    } else if (config.supportType === 'invitation') {
      return `Format Invitation : Le conteneur QR est bridé à 5 cm max. Votre visuel Canva est mis à l'échelle automatiquement sur la largeur restante de la ligne A4.`;
    } else {
      return `Format Badge Pro standard : exportez votre fichier sous les dimensions de 85x54 mm (Rendu net à 300 DPI).`;
    }
  };

  const onManualWidthChange = (cmValue: number) => {
    // cmValue is total width in cm (user-facing). Internally use mm.
    const newTotalWidthMm = Math.round(cmValue * 10);
    // Enforce imageWidth = qrWidth = totalWidth / 2
    const imageWidthMm = Math.round(newTotalWidthMm / 2);
    let newHeightMm = config.customDimensions.height || Math.round(DEFAULT_HEIGHT);
    if (imgNatural) {
      // imageHeight = imageWidth / (w/h) => imageWidth * (h/w)
      newHeightMm = Math.round(imageWidthMm * (imgNatural.height / imgNatural.width));
    } else if (config.customDimensions.width) {
      const prevImageWidth = Math.round((config.customDimensions.width || DEFAULT_WIDTH) / 2);
      const prevRatio = (config.customDimensions.height || DEFAULT_HEIGHT) / Math.max(1, prevImageWidth);
      newHeightMm = Math.round(imageWidthMm * prevRatio);
    }
    setConfig(c => ({ ...c, customDimensions: { width: newTotalWidthMm, height: newHeightMm } }));
  };

  const onManualHeightChange = (cmValue: number) => {
    const newTotalHeightMm = Math.round(cmValue * 10);
    // imageHeight = totalHeight (row height). imageWidth = imageHeight * (w/h)
    let imageWidthMm = config.customDimensions.width ? Math.round((config.customDimensions.width || DEFAULT_WIDTH) / 2) : Math.round(DEFAULT_WIDTH / 2);
    if (imgNatural) {
      imageWidthMm = Math.round(newTotalHeightMm * (imgNatural.width / imgNatural.height));
    } else if (config.customDimensions.height) {
      const prevImageWidth = Math.round((config.customDimensions.width || DEFAULT_WIDTH) / 2);
      const prevHeight = config.customDimensions.height || DEFAULT_HEIGHT;
      const approxRatio = prevImageWidth / Math.max(1, prevHeight);
      imageWidthMm = Math.round(newTotalHeightMm * approxRatio);
    }
    const newTotalWidthMm = Math.round(imageWidthMm * 2);
    setConfig(c => ({ ...c, customDimensions: { width: newTotalWidthMm, height: newTotalHeightMm } }));
  };

  const onManualQrSizeChange = (cmValue: number) => {
    const qrMm = Math.round(cmValue * 10);
    // Only update qrContainerMm — do not touch customDimensions.width/height here.
    setConfig(c => ({ ...c, qrContainerMm: qrMm }));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex justify-center items-center relative">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden flex h-[85vh] min-h-[750px]">
        
        {/* SIDEBAR DE CONFIGURATION (40%) */}
        <aside className="w-2/5 p-6 border-r border-gray-200 overflow-y-auto space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Billet & Badge Editor</h2>
              <p className="text-xs text-gray-500 mt-1">Vos visuels sont scalés au pixel près, sans étirement ni rognage.</p>
            </div>

            {/* Support & Format */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Type de support</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => handleSupportTypeChange('ticket')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-medium text-xs transition-all ${config.supportType === 'ticket' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Layout size={14} /> Ticket
                  </button>
                  <button 
                    onClick={() => handleSupportTypeChange('invitation')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-medium text-xs transition-all ${config.supportType === 'invitation' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Mail size={14} /> Invitation
                  </button>
                  <button 
                    onClick={() => handleSupportTypeChange('badge')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-medium text-xs transition-all ${config.supportType === 'badge' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Edit size={14} /> Badge Pro
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Disposition Papier</label>
                <select 
                  value={config.layoutOption} 
                  onChange={(e) => handleLayoutChange(e.target.value as LayoutOption)} 
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none"
                >
                  <option value="1_col">1 colonne (Conseillé pour Invitations / Plein format)</option>
                  <option value="2_col">2 colonnes (Format Ticket Standard)</option>
                  <option value="3_col">3 colonnes (Format Badge Standard 85x54mm)</option>
                </select>
              </div>
            </div>

            {/* Marges */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <div className="flex items-center gap-2 text-blue-600">
                <Sliders size={16} />
                <h3 className="font-bold text-xs uppercase tracking-wider">Gestion des Marges (Feuille A4)</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Espace Lignes (Row Gap)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="25" value={config.rowGap} onChange={(e) => setConfig(c => ({...c, rowGap: Number(e.target.value)}))} className="w-full accent-blue-600" />
                    <span className="text-xs font-mono w-10 text-right">{config.rowGap}mm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Espace Colonnes (Col Gap)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="25" value={config.colGap} onChange={(e) => setConfig(c => ({...c, colGap: Number(e.target.value)}))} className="w-full accent-blue-600" />
                    <span className="text-xs font-mono w-10 text-right">{config.colGap}mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Design & Note */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">Design original (Sans déformation)</label>
              <div ref={dropRef} className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer bg-white hover:bg-gray-50" onClick={() => document.getElementById('file-loader')?.click()}>
                <div className="flex flex-col items-center justify-center gap-1 text-gray-500">
                  <IconImage size={24} className="text-gray-400" />
                  <span className="text-xs font-medium">Charger le design Canva</span>
                </div>
                <input id="file-loader" type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFile(f); }} />
              </div>

              <p className="text-[11px] text-gray-500 italic bg-blue-50/60 p-2.5 rounded-lg border border-blue-100 leading-relaxed">
                💡 <strong>Conseil de dimension : </strong>{getIdealDimensionsText()}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Couleur par défaut</label>
                  <input type="color" value={config.backgroundColor} onChange={(e) => setConfig(c => ({...c, backgroundColor: e.target.value}))} className="w-full h-9 rounded-lg border cursor-pointer p-0 overflow-hidden" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fond du QR</label>
                  <select value={config.qrBg} onChange={(e) => setConfig(c => ({...c, qrBg: e.target.value as any}))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-sm">
                    <option value="white">Blanc</option>
                    <option value="black">Noir</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 border-t pt-3">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Dimensions manuelles (cm)</label>
                <div className="flex items-center gap-2 mb-2">
                  <input id="manual-dims-toggle" type="checkbox" checked={manualDimsEnabled} onChange={(e) => setManualDimsEnabled(e.target.checked)} className="h-4 w-4" />
                  <label htmlFor="manual-dims-toggle" className="text-xs text-gray-600">Activer saisie manuelle (largeur / longueur)</label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Largeur (cm)</label>
                    <input type="number" min={0.1} step={0.1} value={(config.customDimensions.width || DEFAULT_WIDTH) / 10} onChange={(e) => onManualWidthChange(Number(e.target.value || 0))} disabled={!manualDimsEnabled} className="w-full px-2 py-1 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Longueur (cm)</label>
                    <input type="number" min={0.1} step={0.1} value={(config.customDimensions.height || DEFAULT_HEIGHT) / 10} onChange={(e) => onManualHeightChange(Number(e.target.value || 0))} disabled={!manualDimsEnabled} className="w-full px-2 py-1 border rounded-lg text-sm" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-[11px] text-gray-600 mb-1">Largeur conteneur QR (cm)</label>
                  <input type="number" min={0.5} step={0.1} value={((config.qrContainerMm || 50) / 10)} onChange={(e) => onManualQrSizeChange(Number(e.target.value || 0))} disabled={!manualDimsEnabled} className="w-40 px-2 py-1 border rounded-lg text-sm" />
                </div>
                <p className="text-[11px] text-gray-500 italic mt-2">Lorsque vous modifiez une valeur, l'autre est recalculée automatiquement pour préserver le ratio de l'image et éviter toute déformation. Si aucune image n'est chargée, le ratio courant du design sera utilisé.</p>
              </div>
            </div>

            {/* Recto/Verso */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Emplacement du QR Code</label>
                <select 
                  value={config.qrPosition} 
                  disabled={config.supportType === 'ticket' || config.supportType === 'invitation'} 
                  onChange={(e) => setConfig(c => ({...c, qrPosition: e.target.value as any}))} 
                  className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none"
                >
                  <option value="front">Face avant (Front)</option>
                  <option value="back">Dans le dos (Back - Recto/Verso)</option>
                </select>
              </div>

              {config.qrPosition === 'back' && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">Consignes au verso</label>
                  <textarea rows={2} value={config.backText} onChange={(e) => setConfig(c => ({...c, backText: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none" />
                </div>
              )}
            </div>
          </div>

            <div className="pt-4 border-t border-gray-100">
            <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md" onClick={handleOpenModal} disabled={genPhase === 'running'}>
              Continuer
            </button>
          </div>
        </aside>

        {/* SECTION DE PREVIEW (60%) */}
        <section className="w-3/5 bg-gray-50 p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200/60">
            <div className="bg-gray-200/70 p-1 rounded-xl flex gap-1">
              <button className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${config.activeTab === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`} onClick={() => setConfig(c => ({...c, activeTab: 'single'}))}>
                Aperçu Unitaire
              </button>
              <button className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${config.activeTab === 'sheet' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`} onClick={() => setConfig(c => ({...c, activeTab: 'sheet'}))}>
                Aperçu Feuille A4
              </button>
            </div>

            <div>
              {config.supportType === 'badge' && (
                <button title="Retourner le Badge" className="p-1.5 border bg-white rounded-lg hover:shadow-sm" onClick={() => setFlipped(f => !f)}><RefreshCw size={14} /></button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto space-y-4">
            
            {/* EN-TÊTE DYNAMIQUE DOUBLE ENTRÉE */}
            {config.activeTab === 'sheet' && (
              <div className="w-[400px] bg-slate-900 text-white px-3 py-2 rounded-xl flex items-center justify-between shadow-md border border-slate-800 animate-fadeIn text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Maximize2 size={13} className="text-blue-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Taille :</span>
                  <span className="font-mono font-bold text-white">
                    {currentDims.widthMm / 10}x{currentDims.heightMm / 10} cm
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
                  <Hash size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-slate-300">Rendement :</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {totalTicketsCount} {config.supportType === 'ticket' ? 'billet' : config.supportType === 'invitation' ? 'invitation' : 'badge'}{totalTicketsCount > 1 ? 's' : ''} / page
                  </span>
                </div>
              </div>
            )}

            {/* 1. APERÇU UNITAIRE */}
            {config.activeTab === 'single' && (
              <div className="w-full flex flex-col items-center justify-center gap-6">
                {config.supportType === 'ticket' && (
                  <div 
                    className="flex flex-row items-stretch gap-0 p-0 shadow-2xl border border-gray-300 rounded-lg overflow-hidden"
                    style={{ 
                      height: `150px`, 
                      width: `${(150 * (imgNatural ? imgNatural.width / imgNatural.height : 2.5)) + 150}px`
                    }}
                  >
                    <div className="h-full relative flex items-center justify-center" style={{ width: `${150 * (imgNatural ? imgNatural.width / imgNatural.height : 2.5)}px`, backgroundColor: config.backgroundColor }}>
                      {imgPreviewUrl ? (
                        <img src={imgPreviewUrl} alt="ticket" className="w-full h-full object-contain block" />
                      ) : (
                        <span className="text-xs font-bold text-gray-400 text-center p-4">{config.name}</span>
                      )}
                    </div>
                    <div className="h-full aspect-square flex items-center justify-center border-l border-dashed border-gray-400/80 p-3" style={{ backgroundColor: config.qrBg === 'white' ? '#ffffff' : '#000000' }}>
                      <div className="w-full h-full border-2 border-current flex items-center justify-center font-black text-xs rounded" style={{ color: config.qrBg === 'white' ? '#000000' : '#ffffff' }}>QR</div>
                    </div>
                  </div>
                )}

                {config.supportType === 'invitation' && (
                  <div 
                    className="flex flex-row items-stretch gap-0 p-0 shadow-2xl border border-gray-300 rounded-lg overflow-hidden max-w-full animate-fadeIn"
                    style={{ 
                      height: `160px`, 
                      width: `${(160 * (imgNatural ? imgNatural.width / imgNatural.height : 2.5)) + (50 * (160 / (imgNatural ? (imgNatural.width / (imgNatural.width / imgNatural.height)) : 160)))}px` 
                    }}
                  >
                    {/* Zone Image dynamique */}
                    <div className="flex-1 h-full relative flex items-center justify-center" style={{ backgroundColor: config.backgroundColor }}>
                      {imgPreviewUrl ? (
                        <img src={imgPreviewUrl} alt="invitation visual" className="w-full h-full object-contain block" />
                      ) : (
                        <span className="text-xs font-bold text-gray-400 text-center p-4">{config.name} (Visuel)</span>
                      )}
                    </div>
                    {/* Zone QR Fixe bridée à 5 cm maximum */}
                    <div 
                      className="h-full flex items-center justify-center border-l border-dashed border-gray-400/80 p-2 shrink-0 bg-white" 
                      style={{ 
                        width: `${50 * (160 / currentDims.heightMm)}px`,
                        backgroundColor: config.qrBg === 'white' ? '#ffffff' : '#000000' 
                      }}
                    >
                      <div 
                        className="border-2 border-current flex items-center justify-center font-black text-[10px] rounded shrink-0" 
                        style={{ 
                          width: `${40 * (160 / currentDims.heightMm)}px`, 
                          height: `${40 * (160 / currentDims.heightMm)}px`, 
                          color: config.qrBg === 'white' ? '#000000' : '#ffffff' 
                        }}
                      >
                        QR 4x4
                      </div>
                    </div>
                  </div>
                )}

                {config.supportType === 'badge' && (
                  <div className="w-full max-w-[280px] flex flex-col items-center gap-6">
                    {(!flipped || config.qrPosition === 'front') && (
                      <div className="w-full aspect-[85/54] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden relative flex items-center justify-center">
                        {imgPreviewUrl ? (
                          <img src={imgPreviewUrl} alt="badge front" className="w-full h-full object-contain block" />
                        ) : (
                          <span className="text-sm font-bold text-gray-400">{config.name} - RECTO</span>
                        )}
                      </div>
                    )}
                    {(flipped || config.qrPosition === 'back') && (
                      <div className="w-full aspect-[85/54] rounded-lg shadow-xl border border-gray-200 flex flex-col items-center justify-between p-4 relative" style={{ backgroundColor: config.qrBg === 'white' ? '#ffffff' : '#111827', color: config.qrBg === 'white' ? '#000000' : '#ffffff' }}>
                        <div className="w-14 h-14 border-2 border-current flex items-center justify-center font-bold text-xs rounded mx-auto mt-2">QR</div>
                        <p className="text-[10px] text-center opacity-80 px-2 line-clamp-2 mb-1">{config.backText}</p>
                        <span className="text-[8px] opacity-40 uppercase tracking-wider">Verso</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. APERÇU FEUILLE A4 */}
            {config.activeTab === 'sheet' && (
              <div className="w-full flex items-center justify-center">
                <div 
                  className="bg-white shadow-2xl border border-gray-300 p-4 overflow-hidden flex flex-col justify-start"
                  style={{ width: `${SHEET_PREVIEW_WIDTH_PX}px`, height: `${SHEET_PREVIEW_HEIGHT_PX}px` }}
                >
                  {(() => {
                    const isBadge = config.supportType === 'badge';
                    const isInvitation = config.supportType === 'invitation';
                    const AVAILABLE_WIDTH_PX = SHEET_PREVIEW_WIDTH_PX - 32; 

                    const rGapPx = config.rowGap * MM_TO_PX;
                    const cGapPx = config.colGap * MM_TO_PX;
                    const MM_TO_PX_HEIGHT = SHEET_PREVIEW_HEIGHT_PX / 297;

                    // Default column width if auto (based on available A4 preview)
                    let colWidthPx = (AVAILABLE_WIDTH_PX - (cGapPx * (sheetCols - 1))) / sheetCols;
                    let rowHeightPx = colWidthPx * (54 / 85);

                    // If manual dimensions are enabled, compute pixel sizes from mm values
                    if (manualDimsEnabled) {
                      const manualTotalColPx = config.customDimensions.width * MM_TO_PX;
                      const manualRowPx = config.customDimensions.height * MM_TO_PX_HEIGHT;
                      // Do not let manual column width exceed the per-column available space
                      const maxPerCol = (AVAILABLE_WIDTH_PX - (cGapPx * (sheetCols - 1))) / sheetCols;
                      const totalColPx = Math.min(manualTotalColPx, maxPerCol);

                      // QR container width comes from config.qrContainerMm; image width is the remainder
                      const qrContainerPx = (config.qrContainerMm || 50) * MM_TO_PX;
                      const imageWidthPx = Math.max(0, totalColPx - qrContainerPx);

                      colWidthPx = totalColPx;
                      if (imgNatural) {
                        // imageHeight computed from imageWidth keeping aspect ratio
                        const imageHeightPx = imageWidthPx / (imgNatural.width / imgNatural.height);
                        rowHeightPx = imageHeightPx;
                      } else {
                        rowHeightPx = manualRowPx;
                      }
                    } else if (!isBadge && imgNatural) {
                      // previous automatic behaviour based on image natural ratio
                      if (isInvitation) {
                        const qrWidthPx = 50 * MM_TO_PX;
                        const imageWidthPx = Math.max(30, colWidthPx - qrWidthPx);
                        rowHeightPx = imageWidthPx / (imgNatural.width / imgNatural.height);
                      } else {
                        // Enforce imageWidth = qrWidth = half of column
                        const imageWidthPx = colWidthPx / 2;
                        rowHeightPx = imageWidthPx / (imgNatural.width / imgNatural.height);
                      }
                    }

                    // Use an explicit rendered row height to ensure preview and counting
                    const renderedRowHeightPx = (() => {
                      let h = rowHeightPx;
                      if (manualDimsEnabled) {
                        const manualRowPx = config.customDimensions.height * MM_TO_PX_HEIGHT;
                        h = Math.max(h, manualRowPx);
                      }
                      return h;
                    })();

                    return (
                      <div 
                        className="grid" 
                        style={{ 
                          gridTemplateColumns: `repeat(${sheetCols}, ${colWidthPx}px)`,
                          gridAutoRows: `${renderedRowHeightPx}px`, 
                          rowGap: `${rGapPx}px`,
                          columnGap: `${cGapPx}px`
                        }}
                      >
                        {
                          (() => {
                            const stats = getLiveTotalCount(sheetCols, config.supportType, imgNatural);
                            const totalVisibleTickets = stats.total;
                            return Array.from({ length: totalVisibleTickets }).map((_, idx) => {
                              if (isInvitation) {
                                const qrContainerPx = (config.qrContainerMm || 50) * MM_TO_PX;
                                const imageAreaWidthPx = Math.max(0, colWidthPx - qrContainerPx);
                                return (
                                  <div 
                                    key={idx} 
                                    className="flex flex-row items-stretch gap-0 p-0 border border-gray-200 overflow-hidden"
                                    style={{ height: `${renderedRowHeightPx}px`, backgroundColor: config.backgroundColor }}
                                  >
                                    <div className="overflow-hidden flex items-center justify-center" style={{ width: `${imageAreaWidthPx}px`, height: `${rowHeightPx}px` }}>
                                      {imgPreviewUrl && <img src={imgPreviewUrl} alt="invitation" className="w-full h-full object-contain block" />}
                                    </div>
                                    <div 
                                      className="h-full flex items-center justify-center border-l border-dashed border-gray-200 shrink-0"
                                      style={{ 
                                        width: `${qrContainerPx}px`,
                                        backgroundColor: config.qrBg === 'white' ? '#fff' : '#000', 
                                        color: config.qrBg === 'white' ? '#000' : '#fff' 
                                      }}
                                    >
                                      <div 
                                        className="border flex items-center justify-center text-[7px] font-bold rounded"
                                        style={{ 
                                          width: `${Math.min(renderedRowHeightPx - 6, (config.qrContainerMm || 50) * MM_TO_PX)}px`, 
                                          height: `${Math.min(renderedRowHeightPx - 6, (config.qrContainerMm || 50) * MM_TO_PX)}px`,
                                          borderColor: 'currentColor'
                                        }}
                                      >
                                        QR
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              if (!isBadge) {
                                const qrContainerPx = (config.qrContainerMm || 50) * MM_TO_PX;
                                return (
                                  <div key={idx} className="relative flex items-center justify-between p-0 overflow-hidden border border-gray-200" style={{ height: `${renderedRowHeightPx}px`, backgroundColor: config.backgroundColor }}>
                                    <div className="w-full h-full flex items-center justify-between gap-3 text-left p-3">
                                      {/* ZONE TEXTE / IMAGE : prend tout l'espace sauf le QR */}
                                      <div className="flex-1 min-w-0 flex items-center justify-center">
                                        {imgPreviewUrl ? (
                                          <div className="w-full h-full overflow-hidden flex items-center justify-center">
                                            <img src={imgPreviewUrl} alt="t" className="w-full h-full object-contain block" />
                                          </div>
                                        ) : (
                                          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                                            <span className="text-xs font-bold text-gray-900 truncate uppercase tracking-wide">{config.name}</span>
                                            <span className="text-[10px] text-gray-500 truncate">Ticket #{idx + 1}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* ZONE QR CODE : Taille fixe, ne se réduit pas */}
                                      <div 
                                        style={{ 
                                          width: `${qrContainerPx}px`,
                                          height: `${qrContainerPx}px`
                                        }}
                                        className="flex-shrink-0 bg-white p-1 rounded-lg shadow-2xs flex items-center justify-center"
                                      >
                                        <div className="w-full h-full bg-gray-200 rounded animate-pulse" />
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              if (isBadge && config.qrPosition === 'back') {
                                return (
                                  <div key={idx} className="flex items-stretch gap-0 border border-gray-200 overflow-hidden" style={{ height: `${renderedRowHeightPx}px` }}>
                                    <div className="w-1/2 h-full border-r border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                                      {imgPreviewUrl ? <img src={imgPreviewUrl} alt="f" className="w-full h-full object-contain block" /> : <span className="text-[7px] font-bold text-gray-400">Front</span>}
                                    </div>
                                    <div 
                                      className="w-1/2 h-full flex flex-col items-center justify-center p-1"
                                      style={{ backgroundColor: config.qrBg === 'white' ? '#fff' : '#111827', color: config.qrBg === 'white' ? '#000' : '#fff' }}
                                    >
                                      <div className="w-4 h-4 border border-current flex items-center justify-center text-[5px] font-bold rounded">QR</div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={idx} className="w-full border border-gray-200 bg-white overflow-hidden flex items-center justify-center" style={{ height: `${renderedRowHeightPx}px` }}>
                                  {imgPreviewUrl ? (
                                    <img src={imgPreviewUrl} alt="b" className="w-full h-full object-contain block" />
                                  ) : (
                                    <span className="text-[7px] text-gray-400 font-bold">{config.name}</span>
                                  )}
                                </div>
                              );
                            });
                          })()
                        }
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        </section>
      </div>

      {/* GENERATION MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg mb-3">Génération des billets</h3>
            {genPhase === 'idle' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Événement</label>
                  <select className="w-full px-3 py-2 border rounded-lg" value={selectedEventForGen || ''} onChange={(e) => setSelectedEventForGen(e.target.value)}>
                    <option value="">-- Sélectionnez --</option>
                    {orgEvents.map((ev) => <option key={ev.id} value={ev.id}>{ev.title || ev.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Prix du billet (€)</label>
                  <input type="number" min={0} step="0.01" value={ticketPrice} onChange={(e) => setTicketPrice(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-medium">Nombre de billets</label>
                  <input type="number" min={1} value={ticketCount} onChange={(e) => setTicketCount(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-medium">Type de billet</label>
                  <div className="flex gap-3 mt-2 items-center">
                    <div className="flex gap-2 flex-wrap">
                      {ticketTypes.length > 0 ? (
                        ticketTypes.map((tt) => (
                          <label key={tt.id} className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer ${ticketType === tt.name ? 'bg-blue-50 border-blue-300' : ''}`}>
                            <input type="radio" name="ticket_type" value={tt.name} checked={ticketType === tt.name} onChange={() => setTicketType(tt.name)} />
                            <span className="text-sm">{tt.name}</span>
                          </label>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">Aucun type défini pour cet événement</span>
                      )}
                    </div>

                    {/* bouton d'ajout retiré - ajout des types géré ailleurs */}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 py-2 rounded-lg bg-blue-600 text-white" onClick={handleGenerate}>Générer</button>
                  <button className="flex-1 py-2 rounded-lg border" onClick={() => setModalOpen(false)}>Annuler</button>
                </div>
              </div>
            )}

            {/* Inline add ticket-type floating modal */}
            {addingTypeOpen && (
              <div className="mt-3 p-3 border rounded bg-white shadow-lg">
                <label className="text-xs block mb-1">Nouveau type de billet</label>
                <div className="flex gap-2">
                  <input value={newTicketTypeName} onChange={(e) => setNewTicketTypeName(e.target.value)} className="flex-1 px-3 py-2 border rounded" />
                  <button onClick={addNewTicketType} disabled={addingTypeLoading} className={`px-3 py-2 rounded ${addingTypeLoading ? 'bg-gray-300' : 'bg-green-600 text-white'}`}>
                    {addingTypeLoading ? '...' : 'Ajouter'}
                  </button>
                </div>
              </div>
            )}

            {(genPhase === 'running' || genPhase === 'done' || genPhase === 'error') && (
              <div className="space-y-6 py-4">
                <div className="flex flex-col gap-4">
                  {genLog.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                      {l.startsWith('✓') ? (
                        <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : l.startsWith('❌') ? (
                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                          <AlertTriangle size={14} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                      )}
                      <span className={`text-sm ${l.startsWith('✓') ? 'text-gray-600' : l.startsWith('❌') ? 'text-red-600 font-bold' : 'text-blue-600 font-medium'}`}>
                        {l.replace(/^✓\s|^\❌\s|^⋯\s/, '')}
                      </span>
                    </div>
                  ))}
                </div>

                {genPhase === 'done' && (
                  <div className="pt-6 border-t border-gray-100 animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-6">
                      <p className="text-sm text-emerald-800 font-semibold text-center">
                        Vos billets sont prêts ! Le design respecte les réglages de votre éditeur.
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {pdfUrl && (
                        <a 
                          href={pdfUrl} 
                          download={`billets-${selectedEventForGen}.pdf`}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2"
                        >
                          <Download size={20} /> Télécharger le PDF
                        </a>
                      )}
                      <button 
                        className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                        onClick={() => { setModalOpen(false); setGenPhase('idle'); }}
                      >
                        Retour à l'éditeur
                      </button>
                    </div>
                  </div>
                )}

                {genPhase === 'error' && (
                  <div className="pt-4 border-t border-gray-100">
                    <button 
                      className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-all"
                      onClick={() => setGenPhase('idle')}
                    >
                      Modifier les paramètres et réessayer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP MODAL DE SECURITE (4CM) */}
      {showWarningModal && pendingAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Hauteur d'impression critique</h3>
                <p className="text-xs text-gray-500">Contrôle de conformité de la billetterie</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-600 leading-relaxed">
              Avec vos réglages actuels, la hauteur de votre support sur le papier A4 ne fera que <strong className="text-amber-800">{pendingAction.heightMm} mm</strong> (soit moins de 4,0 cm). À cette taille, le QR Code perd en lisibilité mécanique et la découpe manuelle devient risquée.
            </p>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-[11px] text-gray-500 space-y-1">
              <span className="font-semibold text-gray-700 block">Solutions recommandées :</span>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Diminuer le nombre de colonnes dans la disposition papier.</li>
                <li>Utiliser un visuel Canva possédant une hauteur native plus importante.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                onClick={() => {
                  setShowWarningModal(false);
                  setPendingAction(null);
                }}
                className="flex-1 py-2 text-xs border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all"
              >
                Ajuster mes réglages
              </button>
              <button 
                onClick={() => {
                  if (pendingAction) pendingAction.callback();
                  setShowWarningModal(false);
                  setPendingAction(null);
                }}
                className="flex-1 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md transition-all"
              >
                Poursuivre quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}