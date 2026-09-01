import { useState, useRef, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api';
import { authAPI } from '../services/authAPI';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import QrInteractivePreview from '../components/badge/QrInteractivePreview';
import TicketMarginStrip from '../components/badge/TicketMarginStrip';
import {
  getQrZoneWidthMm,
  computeRowHeightMm,
  getEmbeddedDefaults,
  getMarginDefaults,
  capTicketWidthMm,
  getMarginLayoutMm,
  getMarginQrPosZoneMm,
  MARGIN_LABEL_COL_MM,
  normalizeHexColor,
  getContrastTextColor,
  type QrLayoutMode,
} from '../utils/badgeQrLayout';
import AppPageHeader from '../components/AppPageHeader';
import { serializeGenerationConfig } from '../utils/serializeGenerationConfig';
import { TicketLabelColumn } from '../components/badge/TicketLabelColumn';
import { Image as IconImage, RefreshCw, Layout, Edit, Sliders, AlertTriangle, Maximize2, Hash, Check, Download } from 'lucide-react';

type SupportType = 'invitation' | 'badge';
type LayoutOption = '1_col' | '2_col' | '3_col' | 'custom';

type Config = {
  name: string;
  supportType: SupportType;
  layoutOption: LayoutOption;
  customDimensions: { width: number; height: number }; // mm
  qrPosition: 'front' | 'back';
  qrBg: string;
  qrFg: string;
  qrContainerMm?: number; // largeur du container QR en mm (mode marge)
  qrLayoutMode: QrLayoutMode;
  qrSizeMm: number;
  qrPosX: number;
  qrPosY: number;
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
    activeTab: 'single',
    qrBg: '#0a0a0a',
    qrFg: '#000000',
    qrContainerMm: 50,
    qrLayoutMode: 'margin',
    qrSizeMm: 40,
    qrPosX: 50,
    qrPosY: 50,
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

  const getEffectiveDimensionsMm = (targetCols: number, supportType: SupportType, naturalSize: { width: number; height: number } | null) => {
    if (supportType === 'badge') {
      return { widthMm: 85, heightMm: 54, designWidthMm: 85 };
    }

    const qrContainerMm = config.qrLayoutMode === 'margin' ? (config.qrContainerMm || 50) : 0;

    if (manualDimsEnabled) {
      let heightMm = config.customDimensions.height || DEFAULT_HEIGHT;

      if (config.qrLayoutMode === 'margin') {
        const designWidthMm = config.customDimensions.width || DEFAULT_WIDTH;
        if (naturalSize) {
          heightMm = computeRowHeightMm(designWidthMm, naturalSize, heightMm);
        }
        const marginLayout = getMarginLayoutMm({
          designWidthMm,
          rowHeightMm: heightMm,
          qrContainerMm,
          cols: targetCols,
          colGapMm: config.colGap,
          imgNatural: naturalSize,
        });
        return {
          widthMm: marginLayout.totalWidthMm,
          heightMm: Math.round(heightMm),
          designWidthMm: marginLayout.designDisplayMm,
        };
      }

      if (config.qrLayoutMode === 'embedded') {
        const designWidthMm = config.customDimensions.width || DEFAULT_WIDTH;
        if (naturalSize) {
          heightMm = computeRowHeightMm(designWidthMm, naturalSize, heightMm);
        }
        const cappedTotal = capTicketWidthMm(designWidthMm + MARGIN_LABEL_COL_MM, targetCols, config.colGap);
        const designW = Math.max(10, cappedTotal - MARGIN_LABEL_COL_MM);
        return {
          widthMm: designW + MARGIN_LABEL_COL_MM,
          heightMm: Math.round(heightMm),
          designWidthMm: designW,
        };
      }

      const maxColW = capTicketWidthMm(config.customDimensions.width, targetCols, config.colGap);
      if (naturalSize) {
        heightMm = computeRowHeightMm(maxColW, naturalSize, heightMm);
      }
      return { widthMm: Math.round(maxColW), heightMm: Math.round(heightMm), designWidthMm: Math.round(maxColW) };
    }

    const auto = getLiveDimensionsMm(targetCols, supportType, naturalSize);
    if (config.qrLayoutMode === 'margin' && naturalSize) {
      const marginLayout = getMarginLayoutMm({
        designWidthMm: auto.widthMm - qrContainerMm,
        rowHeightMm: auto.heightMm,
        qrContainerMm,
        cols: targetCols,
        colGapMm: config.colGap,
        imgNatural: naturalSize,
      });
      return {
        widthMm: marginLayout.totalWidthMm,
        heightMm: auto.heightMm,
        designWidthMm: marginLayout.designDisplayMm,
      };
    }
    if (config.qrLayoutMode === 'embedded') {
      const designW = Math.max(10, auto.widthMm - MARGIN_LABEL_COL_MM);
      return {
        widthMm: designW + MARGIN_LABEL_COL_MM,
        heightMm: auto.heightMm,
        designWidthMm: designW,
      };
    }
    return { ...auto, designWidthMm: auto.widthMm };
  };

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
      if (config.qrLayoutMode === 'embedded') {
        const totalWidthMm = Math.round((colWidthPx * 210) / SHEET_PREVIEW_WIDTH_PX);
        const designWidthMm = Math.max(10, totalWidthMm - MARGIN_LABEL_COL_MM);
        const heightMm = computeRowHeightMm(designWidthMm, naturalSize);
        return { widthMm: designWidthMm + MARGIN_LABEL_COL_MM, heightMm, designWidthMm };
      }
      const qrWidthPx = (config.qrContainerMm || 50) * MM_TO_PX;
      const imageWidthPx = Math.max(30, colWidthPx - qrWidthPx);
      const imageRatio = naturalSize.width / naturalSize.height;
      rowHeightPx = imageWidthPx / imageRatio;
    }

    const widthMm = Math.round((colWidthPx * 210) / SHEET_PREVIEW_WIDTH_PX);
    const heightMm = Math.round((rowHeightPx * 297) / SHEET_PREVIEW_HEIGHT_PX);

    return { widthMm, heightMm };
  };

  const calculateRowHeightMm = (targetCols: number, supportType: SupportType, naturalSize: { width: number; height: number } | null) => {
    return getLiveDimensionsMm(targetCols, supportType, naturalSize).heightMm;
  };

  // Strict/predictive total count using the exact rendered ticket height
  const getLiveTotalCount = (
    targetCols: number,
    supportType: SupportType,
    naturalSize: { width: number; height: number } | null,
    effectiveDims: { widthMm: number; heightMm: number; designWidthMm?: number }
  ) => {
    const isBadge = supportType === 'badge';
    const AVAILABLE_HEIGHT_PX = SHEET_PREVIEW_HEIGHT_PX - 32;

    const rGapPx = config.rowGap * MM_TO_PX;

    let rowHeightPx = effectiveDims.widthMm * MM_TO_PX * (54 / 85);

    if (naturalSize && !isBadge) {
      const designWidthMm = effectiveDims.designWidthMm ?? effectiveDims.widthMm;
      rowHeightPx = (designWidthMm * MM_TO_PX) / (naturalSize.width / naturalSize.height);
    } else {
      rowHeightPx = effectiveDims.heightMm * MM_TO_PX_HEIGHT;
    }

    const renderedTicketHeight = manualDimsEnabled
      ? Math.max(rowHeightPx, (config.customDimensions.height || DEFAULT_HEIGHT) * MM_TO_PX_HEIGHT)
      : rowHeightPx;

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
    const targetCols = type === 'invitation' ? 1 : 3;
    const targetPosition = type === 'invitation' ? 'front' : 'back';
    checkHeightAndExecute(targetCols, type, imgNatural, () => {
      setConfig(c => ({
        ...c,
        supportType: type,
        layoutOption: type === 'invitation' ? '1_col' : '3_col',
        qrPosition: targetPosition,
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

  // Dimensions effectives (aperçu + PDF) — plafonnées à la largeur A4
  const currentDims = getEffectiveDimensionsMm(sheetCols, config.supportType, imgNatural);
  const layoutStats = getLiveTotalCount(sheetCols, config.supportType, imgNatural, currentDims);
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
        price: ticketPrice,
        design_image_data: imageData,
        config: serializeGenerationConfig(config, {
          widthMm: currentDims.widthMm,
          heightMm: currentDims.heightMm,
          designWidthMm: currentDims.designWidthMm,
        }),
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
    if (config.qrLayoutMode === 'embedded') {
      return `Mode incrusté : QR sur le visuel + bande latérale colorée avec libellés verticaux.`;
    }
    if (config.supportType === 'invitation') {
      return `Format Ticket/Invitation : le conteneur QR est configurable. Votre visuel Canva est mis à l'échelle sur la largeur restante de la ligne A4.`;
    }
    return `Format Badge Pro standard : exportez votre fichier sous les dimensions de 85x54 mm (Rendu net à 300 DPI).`;
  };

  const onManualWidthChange = (cmValue: number) => {
    const newDesignWidthMm = Math.round(cmValue * 10);
    let newHeightMm = config.customDimensions.height || Math.round(DEFAULT_HEIGHT);

    if (config.qrLayoutMode === 'margin' || config.qrLayoutMode === 'embedded') {
      if (imgNatural) {
        newHeightMm = Math.round(newDesignWidthMm * (imgNatural.height / imgNatural.width));
      }
      setConfig(c => ({ ...c, customDimensions: { width: newDesignWidthMm, height: newHeightMm } }));
      return;
    }

    let newTotalWidthMm = newDesignWidthMm;
    if (imgNatural) {
      newHeightMm = Math.round(newTotalWidthMm * (imgNatural.height / imgNatural.width));
    } else if (config.customDimensions.width) {
      const prevRatio = (config.customDimensions.height || DEFAULT_HEIGHT) / Math.max(1, config.customDimensions.width);
      newHeightMm = Math.round(newTotalWidthMm * prevRatio);
    }
    setConfig(c => ({ ...c, customDimensions: { width: newTotalWidthMm, height: newHeightMm } }));
  };

  const onManualHeightChange = (cmValue: number) => {
    const newHeightMm = Math.round(cmValue * 10);

    if (config.qrLayoutMode === 'margin' || config.qrLayoutMode === 'embedded') {
      let designWidthMm = config.customDimensions.width || DEFAULT_WIDTH;
      if (imgNatural) {
        designWidthMm = Math.round(newHeightMm * (imgNatural.width / imgNatural.height));
      } else if (config.customDimensions.height) {
        const prevDesignW = config.customDimensions.width || DEFAULT_WIDTH;
        const approxRatio = prevDesignW / Math.max(1, config.customDimensions.height);
        designWidthMm = Math.round(newHeightMm * approxRatio);
      }
      setConfig(c => ({ ...c, customDimensions: { width: designWidthMm, height: newHeightMm } }));
      return;
    }

    let newTotalWidthMm = config.customDimensions.width || DEFAULT_WIDTH;
    if (imgNatural) {
      newTotalWidthMm = Math.round(newHeightMm * (imgNatural.width / imgNatural.height));
    } else if (config.customDimensions.height) {
      const prevTotalW = config.customDimensions.width || DEFAULT_WIDTH;
      const approxRatio = prevTotalW / Math.max(1, config.customDimensions.height);
      newTotalWidthMm = Math.round(newHeightMm * approxRatio);
    }
    setConfig(c => ({ ...c, customDimensions: { width: newTotalWidthMm, height: newHeightMm } }));
  };

  const handleQrLayoutModeChange = (mode: QrLayoutMode) => {
    const defaults = mode === 'embedded'
      ? getEmbeddedDefaults(config.supportType)
      : getMarginDefaults(config.supportType);
    setConfig(c => ({
      ...c,
      qrLayoutMode: mode,
      activeTab: 'single',
      ...defaults,
      qrContainerMm: mode === 'margin' ? (getMarginDefaults(config.supportType).qrContainerMm ?? c.qrContainerMm) : 0,
    }));
  };

  const patchQrLayout = useCallback((patch: Partial<Pick<Config, 'qrLayoutMode' | 'qrContainerMm' | 'qrSizeMm' | 'qrPosX' | 'qrPosY' | 'qrBg' | 'qrFg'>>) => {
    setConfig(c => ({ ...c, ...patch }));
  }, []);

  const qrZoneWidthMm = getQrZoneWidthMm(
    config.qrLayoutMode,
    config.supportType,
    currentDims.heightMm,
    config.qrContainerMm || 50
  );
  const designWidthMm = currentDims.designWidthMm ?? Math.max(10, currentDims.widthMm - qrZoneWidthMm);

  return (
    <div className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen badge-editor-page">
      <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28">
        <AppPageHeader
          title="Billet & Badge Editor"
          subtitle="Vos visuels sont scalés au pixel près, sans étirement ni rognage."
        />

        <div className="badge-editor-shell">
          <aside className="badge-editor-sidebar">
            <div className="badge-editor-section">
              <p className="badge-editor-section__title">
                <Layout size={14} />
                Type de support
              </p>
              <div className="badge-segment">
                <button
                  type="button"
                  onClick={() => handleSupportTypeChange('invitation')}
                  className={`badge-segment__btn ${config.supportType === 'invitation' ? 'badge-segment__btn--active' : ''}`}
                >
                  <Layout size={14} /> Ticket/Invitation
                </button>
                <button
                  type="button"
                  onClick={() => handleSupportTypeChange('badge')}
                  className={`badge-segment__btn ${config.supportType === 'badge' ? 'badge-segment__btn--active' : ''}`}
                >
                  <Edit size={14} /> Badge Pro
                </button>
              </div>
              <div className="mt-4">
                <label className="badge-field-label">Disposition papier</label>
                <select
                  value={config.layoutOption}
                  onChange={(e) => handleLayoutChange(e.target.value as LayoutOption)}
                  className="badge-select"
                >
                  <option value="1_col">1 colonne (Conseillé Ticket/Invitation — plein format)</option>
                  <option value="2_col">2 colonnes (Ticket/Invitation compact)</option>
                  <option value="3_col">3 colonnes (Format Badge Standard 85×54 mm)</option>
                </select>
              </div>
            </div>

            <div className="badge-editor-section">
              <p className="badge-editor-section__title">
                <Sliders size={14} />
                Gestion des marges (feuille A4)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="badge-field-label">Espace lignes</label>
                  <div className="badge-range-row">
                    <input type="range" min="0" max="25" value={config.rowGap} onChange={(e) => setConfig(c => ({ ...c, rowGap: Number(e.target.value) }))} />
                    <span className="badge-range-value">{config.rowGap}mm</span>
                  </div>
                </div>
                <div>
                  <label className="badge-field-label">Espace colonnes</label>
                  <div className="badge-range-row">
                    <input type="range" min="0" max="25" value={config.colGap} onChange={(e) => setConfig(c => ({ ...c, colGap: Number(e.target.value) }))} />
                    <span className="badge-range-value">{config.colGap}mm</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="badge-editor-section">
              <p className="badge-editor-section__title">
                <IconImage size={14} />
                Design original
              </p>
              <div ref={dropRef} className="badge-upload-zone" onClick={() => document.getElementById('file-loader')?.click()}>
                <div className="flex flex-col items-center justify-center gap-1.5 app-text-muted">
                  <IconImage size={22} className="opacity-50" />
                  <span className="text-xs font-semibold">Charger le design Canva</span>
                </div>
                <input id="file-loader" type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFile(f); }} />
              </div>

              <p className="badge-tip mt-3">
                <strong>Conseil de dimension :</strong> {getIdealDimensionsText()}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="badge-field-label">Couleur par défaut</label>
                  <input type="color" value={config.backgroundColor} onChange={(e) => setConfig(c => ({ ...c, backgroundColor: e.target.value }))} className="badge-color-input" />
                </div>
                {config.supportType === 'invitation' && (
                  <>
                    <div>
                      <label className="badge-field-label">Fond du conteneur</label>
                      <input type="color" value={normalizeHexColor(config.qrBg, '#0a0a0a')} onChange={(e) => setConfig(c => ({ ...c, qrBg: e.target.value }))} className="badge-color-input" />
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <label className="badge-field-label">Couleur du QR code</label>
                        <input type="color" value={normalizeHexColor(config.qrFg, '#000000')} onChange={(e) => setConfig(c => ({ ...c, qrFg: e.target.value }))} className="badge-color-input" />
                      </div>
                      <div className="flex items-end">
                        <p className="text-[10px] app-text-muted leading-snug pb-0.5">Appliquée à la bande latérale et au fond du carré QR.</p>
                      </div>
                    </div>
                  </>
                )}
                {config.supportType === 'badge' && (
                  <div>
                    <label className="badge-field-label">Fond du QR (verso)</label>
                    <input type="color" value={normalizeHexColor(config.qrBg, '#ffffff')} onChange={(e) => setConfig(c => ({ ...c, qrBg: e.target.value }))} className="badge-color-input" />
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--md-border)]">
                <p className="badge-editor-section__title mb-3">Dimensions manuelles (cm)</p>
                <div className="flex items-center gap-2 mb-3">
                  <input id="manual-dims-toggle" type="checkbox" checked={manualDimsEnabled} onChange={(e) => setManualDimsEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--landing-primary)]" />
                  <label htmlFor="manual-dims-toggle" className="text-xs app-text-muted">Activer la saisie manuelle</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="badge-field-label">
                      {config.qrLayoutMode === 'margin' ? 'Largeur design (cm)' : 'Largeur (cm)'}
                    </label>
                    <input type="number" min={0.1} step={0.1} value={(config.customDimensions.width || DEFAULT_WIDTH) / 10} onChange={(e) => onManualWidthChange(Number(e.target.value || 0))} disabled={!manualDimsEnabled} className="badge-input" />
                  </div>
                  <div>
                    <label className="badge-field-label">Longueur (cm)</label>
                    <input type="number" min={0.1} step={0.1} value={(config.customDimensions.height || DEFAULT_HEIGHT) / 10} onChange={(e) => onManualHeightChange(Number(e.target.value || 0))} disabled={!manualDimsEnabled} className="badge-input" />
                  </div>
                </div>
                <p className="text-[11px] app-text-muted mt-2">Utilisez l&apos;aperçu unitaire pour positionner et redimensionner le QR visuellement.</p>
              </div>
            </div>

            <div className="badge-editor-section">
              <p className="badge-editor-section__title">Style de positionnement QR</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQrLayoutModeChange('margin')}
                  disabled={config.supportType === 'badge'}
                  className={`badge-mode-card ${config.qrLayoutMode === 'margin' ? 'badge-mode-card--active' : ''}`}
                >
                  Marge
                  <span className="badge-mode-card__hint">QR dans une bande colorée — libellés blancs en vertical</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQrLayoutModeChange('embedded')}
                  disabled={config.supportType === 'badge'}
                  className={`badge-mode-card badge-mode-card--embedded ${config.qrLayoutMode === 'embedded' ? 'badge-mode-card--active' : ''}`}
                >
                  Incrusté
                  <span className="badge-mode-card__hint">QR positionné sur le visuel importé</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 mt-4">
                <label className="badge-field-label mb-0 shrink-0">Emplacement QR</label>
                <select
                  value={config.qrPosition}
                  disabled={config.supportType === 'invitation'}
                  onChange={(e) => setConfig(c => ({ ...c, qrPosition: e.target.value as 'front' | 'back' }))}
                  className="badge-select max-w-[11rem]"
                >
                  <option value="front">Face avant</option>
                  <option value="back">Verso (Recto/Verso)</option>
                </select>
              </div>

              {config.qrPosition === 'back' && (
                <div className="mt-3">
                  <label className="badge-field-label">Consignes au verso</label>
                  <textarea rows={2} value={config.backText} onChange={(e) => setConfig(c => ({ ...c, backText: e.target.value }))} className="badge-input resize-none" />
                </div>
              )}
            </div>

            <button type="button" className="badge-editor-cta mt-auto" onClick={handleOpenModal} disabled={genPhase === 'running'}>
              Continuer
            </button>
          </aside>

          <section className="badge-editor-stage">
            <div className="badge-editor-stage__toolbar">
              <div className="badge-editor-tabs">
                <button type="button" className={`badge-editor-tab ${config.activeTab === 'single' ? 'badge-editor-tab--active' : ''}`} onClick={() => setConfig(c => ({ ...c, activeTab: 'single' }))}>
                  Aperçu unitaire
                </button>
                <button type="button" className={`badge-editor-tab ${config.activeTab === 'sheet' ? 'badge-editor-tab--active' : ''}`} onClick={() => setConfig(c => ({ ...c, activeTab: 'sheet' }))}>
                  Aperçu feuille A4
                </button>
              </div>

              {config.supportType === 'badge' && (
                <button type="button" title="Retourner le badge" className="landing-chip" onClick={() => setFlipped(f => !f)}>
                  <RefreshCw size={14} />
                  Retourner
                </button>
              )}
            </div>

            <div className="badge-editor-canvas">

              {config.activeTab === 'sheet' && (
                <div className="badge-sheet-stats animate-fadeIn">
                  <div className="badge-sheet-stats__item">
                    <Maximize2 size={13} className="text-blue-400 shrink-0" />
                    <span className="opacity-70">Taille</span>
                    <span className="badge-sheet-stats__value">
                      {currentDims.widthMm / 10}×{currentDims.heightMm / 10} cm
                    </span>
                  </div>
                  <div className="badge-sheet-stats__item">
                    <Hash size={13} className="text-emerald-400 shrink-0" />
                    <span className="opacity-70">Rendement</span>
                    <span className="badge-sheet-stats__value text-emerald-400">
                      {totalTicketsCount} {config.supportType === 'invitation' ? 'billet' : 'badge'}{totalTicketsCount > 1 ? 's' : ''}/page
                    </span>
                  </div>
                </div>
              )}
            {config.activeTab === 'single' && (
              <div className="w-full flex flex-col items-center justify-center gap-6">
                {config.supportType === 'invitation' && (
                  <QrInteractivePreview
                    supportType={config.supportType}
                    layout={{
                      qrLayoutMode: config.qrLayoutMode,
                      qrContainerMm: config.qrContainerMm || 50,
                      qrSizeMm: config.qrSizeMm || 40,
                      qrPosX: config.qrPosX,
                      qrPosY: config.qrPosY,
                      qrBg: config.qrBg,
                      qrFg: config.qrFg,
                    }}
                    designWidthMm={designWidthMm}
                    designHeightMm={currentDims.heightMm}
                    imgPreviewUrl={imgPreviewUrl}
                    backgroundColor={config.backgroundColor}
                    designLabel={config.name}
                    onChange={patchQrLayout}
                  />
                )}

                {config.supportType === 'badge' && (
                  <div className="w-full max-w-[280px] flex flex-col items-center gap-6">
                    {(!flipped || config.qrPosition === 'front') && (
                      <div className="w-full aspect-[85/54] badge-preview-frame rounded-lg overflow-hidden relative flex items-center justify-center border border-black">
                        {imgPreviewUrl ? (
                          <img src={imgPreviewUrl} alt="badge front" className="w-full h-full object-contain block" />
                        ) : (
                          <span className="text-sm font-bold app-text-muted">{config.name} — Recto</span>
                        )}
                      </div>
                    )}
                    {(flipped || config.qrPosition === 'back') && (
                      <div className="w-full aspect-[85/54] badge-preview-frame rounded-lg flex flex-col items-center justify-between p-4 relative border border-black" style={{ backgroundColor: normalizeHexColor(config.qrBg, '#ffffff'), color: getContrastTextColor(normalizeHexColor(config.qrBg, '#ffffff')) }}>
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
                  className="badge-preview-frame p-4 overflow-hidden flex flex-col justify-start"
                  style={{ width: `${SHEET_PREVIEW_WIDTH_PX}px`, height: `${SHEET_PREVIEW_HEIGHT_PX}px` }}
                >
                  {(() => {
                    const isBadge = config.supportType === 'badge';
                    const AVAILABLE_WIDTH_PX = SHEET_PREVIEW_WIDTH_PX - 32; 

                    const rGapPx = config.rowGap * MM_TO_PX;
                    const cGapPx = config.colGap * MM_TO_PX;
                    const MM_TO_PX_HEIGHT = SHEET_PREVIEW_HEIGHT_PX / 297;

                    // Default column width if auto (based on available A4 preview)
                    let colWidthPx = currentDims.widthMm * MM_TO_PX;
                    let rowHeightPx = currentDims.heightMm * MM_TO_PX_HEIGHT;

                    if (!manualDimsEnabled && !isBadge && imgNatural) {
                      colWidthPx = (AVAILABLE_WIDTH_PX - (cGapPx * (sheetCols - 1))) / sheetCols;
                      if (config.qrLayoutMode === 'embedded') {
                        rowHeightPx = colWidthPx / (imgNatural.width / imgNatural.height);
                      } else {
                        const qrWidthPx = (config.qrContainerMm || 50) * MM_TO_PX;
                        const imageWidthPx = Math.max(30, colWidthPx - qrWidthPx);
                        rowHeightPx = imageWidthPx / (imgNatural.width / imgNatural.height);
                      }
                    }

                    const renderedRowHeightPx = manualDimsEnabled
                      ? Math.max(rowHeightPx, (config.customDimensions.height || DEFAULT_HEIGHT) * MM_TO_PX_HEIGHT)
                      : rowHeightPx;

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
                            const stats = getLiveTotalCount(sheetCols, config.supportType, imgNatural, currentDims);
                            const totalVisibleTickets = stats.total;
                            const marginDesignWidthPx = (currentDims.designWidthMm ?? currentDims.widthMm) * MM_TO_PX;
                            const marginQrWidthPx = qrZoneWidthMm * MM_TO_PX;
                            const marginQrPosZonePx = getMarginQrPosZoneMm(qrZoneWidthMm) * MM_TO_PX;
                            const labelStripPx = MARGIN_LABEL_COL_MM * MM_TO_PX;
                            const containerBg = normalizeHexColor(config.qrBg, '#0a0a0a');
                            const qrFgColor = normalizeHexColor(config.qrFg, '#000000');
                            const embeddedDesignWidthPx = (currentDims.designWidthMm ?? currentDims.widthMm - MARGIN_LABEL_COL_MM) * MM_TO_PX;
                            return Array.from({ length: totalVisibleTickets }).map((_, idx) => {
                              const cellPxPerMm = renderedRowHeightPx / Math.max(currentDims.heightMm, 1);
                              const qrSizePx = (config.qrSizeMm || 40) * cellPxPerMm;

                              const renderQrOverlay = (zoneWidthPx: number, zoneHeightPx: number) => {
                                const cx = (config.qrPosX / 100) * zoneWidthPx;
                                const cy = (config.qrPosY / 100) * zoneHeightPx;
                                return (
                                  <div
                                    className="absolute border flex items-center justify-center text-[7px] font-bold rounded z-10"
                                    style={{
                                      left: `${cx - qrSizePx / 2}px`,
                                      top: `${cy - qrSizePx / 2}px`,
                                      width: `${qrSizePx}px`,
                                      height: `${qrSizePx}px`,
                                      backgroundColor: containerBg,
                                      borderColor: qrFgColor,
                                      color: qrFgColor,
                                    }}
                                  >
                                    QR
                                  </div>
                                );
                              };

                              if (config.qrLayoutMode === 'embedded' && !isBadge) {
                                return (
                                  <div
                                    key={idx}
                                    className="relative flex flex-row border border-black overflow-hidden shrink-0"
                                    style={{ width: `${colWidthPx}px`, height: `${renderedRowHeightPx}px`, backgroundColor: config.backgroundColor }}
                                  >
                                    <div className="relative overflow-hidden shrink-0" style={{ width: `${embeddedDesignWidthPx}px`, height: `${renderedRowHeightPx}px` }}>
                                      {imgPreviewUrl ? (
                                        <img src={imgPreviewUrl} alt="design" className="h-full w-full object-contain object-left block" />
                                      ) : (
                                        <span className="text-[8px] font-bold text-gray-400 p-2">{config.name}</span>
                                      )}
                                      {renderQrOverlay(embeddedDesignWidthPx, renderedRowHeightPx)}
                                    </div>
                                    <TicketLabelColumn
                                      heightPx={renderedRowHeightPx}
                                      backgroundColor={containerBg}
                                      widthPx={labelStripPx}
                                    />
                                  </div>
                                );
                              }

                              if (!isBadge && config.qrLayoutMode !== 'embedded') {
                                return (
                                  <div 
                                    key={idx} 
                                    className="relative flex flex-row items-stretch gap-0 p-0 border border-black overflow-hidden shrink-0"
                                    style={{ width: `${colWidthPx}px`, height: `${renderedRowHeightPx}px`, backgroundColor: config.backgroundColor }}
                                  >
                                    <div className="overflow-hidden flex items-center justify-start shrink-0" style={{ width: `${marginDesignWidthPx}px`, height: `${renderedRowHeightPx}px` }}>
                                      {imgPreviewUrl && <img src={imgPreviewUrl} alt="ticket" className="h-full w-full object-contain object-left block" />}
                                    </div>
                                    <TicketMarginStrip widthPx={marginQrWidthPx} heightPx={renderedRowHeightPx} backgroundColor={containerBg}>
                                      {renderQrOverlay(marginQrPosZonePx, renderedRowHeightPx)}
                                    </TicketMarginStrip>
                                  </div>
                                );
                              }

                              if (isBadge && config.qrPosition === 'back') {
                                return (
                                  <div key={idx} className="flex items-stretch gap-0 border border-black overflow-hidden" style={{ height: `${renderedRowHeightPx}px` }}>
                                    <div className="w-1/2 h-full border-r border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                                      {imgPreviewUrl ? <img src={imgPreviewUrl} alt="f" className="w-full h-full object-contain block" /> : <span className="text-[7px] font-bold text-gray-400">Front</span>}
                                    </div>
                                    <div 
                                      className="w-1/2 h-full flex flex-col items-center justify-center p-1"
                                      style={{ backgroundColor: normalizeHexColor(config.qrBg, '#ffffff'), color: getContrastTextColor(normalizeHexColor(config.qrBg, '#ffffff')) }}
                                    >
                                      <div className="w-4 h-4 border border-current flex items-center justify-center text-[5px] font-bold rounded">QR</div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={idx} className="w-full border border-black bg-white overflow-hidden flex items-center justify-center" style={{ height: `${renderedRowHeightPx}px` }}>
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
      </div>

      {modalOpen && (
        <div className="fixed inset-0 badge-modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="badge-modal p-6 w-full max-w-md">
            <h3 className="font-landing-display text-lg app-heading mb-4">Génération des billets</h3>
            {genPhase === 'idle' && (
              <div className="space-y-4">
                <div>
                  <label className="badge-field-label">Événement</label>
                  <select className="badge-select" value={selectedEventForGen || ''} onChange={(e) => setSelectedEventForGen(e.target.value)}>
                    <option value="">— Sélectionnez —</option>
                    {orgEvents.map((ev) => <option key={ev.id} value={ev.id}>{ev.title || ev.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="badge-field-label">Prix du billet (€)</label>
                  <input type="number" min={0} step="0.01" value={ticketPrice} onChange={(e) => setTicketPrice(Number(e.target.value))} className="badge-input" />
                </div>
                <div>
                  <label className="badge-field-label">Nombre de billets</label>
                  <input type="number" min={1} value={ticketCount} onChange={(e) => setTicketCount(Number(e.target.value))} className="badge-input" />
                </div>
                <div>
                  <label className="badge-field-label">Type de billet</label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {ticketTypes.length > 0 ? (
                      ticketTypes.map((tt) => (
                        <label key={tt.id} className={`landing-chip cursor-pointer ${ticketType === tt.name ? 'landing-chip--active' : ''}`}>
                          <input type="radio" name="ticket_type" value={tt.name} checked={ticketType === tt.name} onChange={() => setTicketType(tt.name)} className="sr-only" />
                          {tt.name}
                        </label>
                      ))
                    ) : (
                      <span className="text-sm app-text-muted">Aucun type défini pour cet événement</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" className="badge-editor-cta flex-1" onClick={handleGenerate}>Générer</button>
                  <button type="button" className="flex-1 py-2.5 rounded-xl border border-[var(--md-border)] app-text-muted font-semibold text-sm hover:bg-[var(--md-surface-muted)] transition-colors" onClick={() => setModalOpen(false)}>Annuler</button>
                </div>
              </div>
            )}

            {addingTypeOpen && (
              <div className="mt-3 p-3 badge-editor-section">
                <label className="badge-field-label">Nouveau type de billet</label>
                <div className="flex gap-2">
                  <input value={newTicketTypeName} onChange={(e) => setNewTicketTypeName(e.target.value)} className="badge-input flex-1" />
                  <button type="button" onClick={addNewTicketType} disabled={addingTypeLoading} className={`px-3 py-2 rounded-lg text-sm font-semibold ${addingTypeLoading ? 'opacity-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                    {addingTypeLoading ? '…' : 'Ajouter'}
                  </button>
                </div>
              </div>
            )}

            {(genPhase === 'running' || genPhase === 'done' || genPhase === 'error') && (
              <div className="space-y-6 py-2">
                <div className="flex flex-col gap-4">
                  {genLog.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                      {l.startsWith('✓') ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : l.startsWith('❌') ? (
                        <div className="w-6 h-6 rounded-full bg-red-500/15 text-red-600 flex items-center justify-center">
                          <AlertTriangle size={14} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-[var(--landing-primary)] border-t-transparent animate-spin" />
                      )}
                      <span className={`text-sm ${l.startsWith('✓') ? 'app-text-muted' : l.startsWith('❌') ? 'text-red-600 font-bold' : 'text-[var(--landing-primary)] font-medium'}`}>
                        {l.replace(/^✓\s|^\❌\s|^⋯\s/, '')}
                      </span>
                    </div>
                  ))}
                </div>

                {genPhase === 'done' && (
                  <div className="pt-4 border-t border-[var(--md-border)] animate-in fade-in zoom-in-95 duration-500">
                    <div className="badge-tip mb-5 text-center">
                      Vos billets sont prêts. Le design respecte les réglages de votre éditeur.
                    </div>
                    <div className="flex flex-col gap-3">
                      {pdfUrl && (
                        <a
                          href={pdfUrl}
                          download={`billets-${selectedEventForGen}.pdf`}
                          className="badge-editor-cta py-3.5 flex items-center justify-center gap-2 no-underline"
                        >
                          <Download size={18} /> Télécharger le PDF
                        </a>
                      )}
                      <button
                        type="button"
                        className="w-full py-2.5 app-text-muted hover:app-heading text-sm font-medium transition-colors"
                        onClick={() => { setModalOpen(false); setGenPhase('idle'); }}
                      >
                        Retour à l&apos;éditeur
                      </button>
                    </div>
                  </div>
                )}

                {genPhase === 'error' && (
                  <div className="pt-4 border-t border-[var(--md-border)]">
                    <button
                      type="button"
                      className="w-full py-3 rounded-xl border border-[var(--md-border)] app-text-muted font-semibold text-sm hover:bg-[var(--md-surface-muted)] transition-colors"
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

      {showWarningModal && pendingAction && (
        <div className="fixed inset-0 badge-modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="badge-modal p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 className="font-landing-display text-base app-heading">Hauteur d&apos;impression critique</h3>
                <p className="text-xs app-text-muted">Contrôle de conformité de la billetterie</p>
              </div>
            </div>

            <p className="text-xs app-text-muted leading-relaxed">
              Avec vos réglages actuels, la hauteur de votre support sur le papier A4 ne fera que <strong className="text-amber-700">{pendingAction.heightMm} mm</strong> (soit moins de 4,0 cm). À cette taille, le QR Code perd en lisibilité mécanique et la découpe manuelle devient risquée.
            </p>

            <div className="badge-tip space-y-1">
              <span className="font-semibold block">Solutions recommandées</span>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Diminuer le nombre de colonnes dans la disposition papier.</li>
                <li>Utiliser un visuel Canva possédant une hauteur native plus importante.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWarningModal(false);
                  setPendingAction(null);
                }}
                className="flex-1 py-2.5 text-xs border border-[var(--md-border)] app-text-muted rounded-xl hover:bg-[var(--md-surface-muted)] font-semibold transition-all"
              >
                Ajuster mes réglages
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingAction) pendingAction.callback();
                  setShowWarningModal(false);
                  setPendingAction(null);
                }}
                className="flex-1 py-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md transition-all"
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