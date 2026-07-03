import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SocialPlatformIcon from '../components/SocialPlatformIcon';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import PublicationTemplate, { type TicketCard } from '../components/PublicationTemplate';

interface SocialLinkItem {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'twitter' | 'website';
  url: string;
}

interface LandingPageData {
  title: string;
  subtitle: string;
  dateText: string;
  description: string;
  heroImage: string;
  ticketLabel: string;
  aboutTitle: string;
  aboutText: string;
  aboutParagraphs: string[];
  aboutImage: string;
  location: string;
  templateStyle: 'default' | 'compact' | 'split';
  themePreset: 'indigo' | 'cyberpunk' | 'forest' | 'crimson' | 'amber';
  heroTitle: string;
  heroSubtitle: string;
  customButtonText: string;
  publicDescription: string;
  hideAboutSection: boolean;
  contactEmail: string;
  contactPhone: string;
  socialLinks: SocialLinkItem[]; // Transformé en tableau dynamique
  isPublished: boolean;
  visibleTickets: string[];
}

const defaultData: LandingPageData = {
  title: 'Sommet de l’Innovation Logistique',
  subtitle: 'Le rendez-vous incontournable des experts de l’événementiel et de la gestion de flux.',
  dateText: '12-14 JUILLET 2024',
  description: 'Le rendez-vous incontournable des experts de l’événementiel et de la gestion de flux au cœur de Toliara.',
  heroImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  ticketLabel: 'Acheter un billet',
  aboutTitle: 'À propos de l’événement',
  aboutText: 'L’EventPro Summit réunit professionnels, intervenants et organisateurs autour des meilleures pratiques pour créer des événements plus fluides, sûrs et inspirants.',
  aboutParagraphs: [],
  aboutImage: '',
  location: '',
  templateStyle: 'default',
  themePreset: 'indigo',
  heroTitle: 'Sommet de l’Innovation Logistique',
  heroSubtitle: 'Le rendez-vous incontournable des experts de l’événementiel et de la gestion de flux.',
  customButtonText: 'Acheter un billet',
  publicDescription: 'Plongez dans une expérience immersive, conçue pour les professionnels de la logistique et de l’événementiel.',
  hideAboutSection: false,
  contactEmail: 'contact@eventpro.mg',
  contactPhone: '+261 34 00 000 00',
  socialLinks: [
    { platform: 'facebook', url: 'https://facebook.com/' },
    { platform: 'instagram', url: 'https://instagram.com/' }
  ],
  isPublished: false,
  visibleTickets: [],
};

// Configuration des plateformes disponibles et leurs icônes SVG natives
const AVAILABLE_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: '💻' },
  { id: 'instagram', name: 'Instagram', icon: '📸' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'youtube', name: 'YouTube', icon: '📺' },
  { id: 'twitter', name: 'X / Twitter', icon: '🐦' },
  { id: 'website', name: 'Site Web', icon: '🌐' },
] as const;

// Mapping for theme -> icon background class to give better contrast for white icons
const THEME_ICON_BG: Record<string, string> = {
  indigo: 'bg-indigo-600',
  cyberpunk: 'bg-fuchsia-500',
  forest: 'bg-emerald-600',
  crimson: 'bg-rose-600',
  amber: 'bg-amber-500',
};

const defaultTickets: TicketCard[] = [
  {
    badge: 'Offre Limitée',
    title: 'Early Bird',
    price: '150.000',
    currency: 'Ar',
    bulletPoints: ['Accès conférences', 'Badge digital', 'Pause café incluse'],
  },
  {
    badge: 'Populaire',
    title: 'Standard Pass',
    price: '250.000',
    currency: 'Ar',
    bulletPoints: ['Tout le Early Bird', 'Déjeuner networking', 'Accès aux ateliers', 'Certificat de participation'],
    featured: true,
    badgeColor: 'text-primary',
  },
  {
    badge: 'Premium',
    title: 'VIP Experience',
    price: '500.000',
    currency: 'Ar',
    bulletPoints: ['Tout le Standard Pass', 'Sièges VIP front-row', 'Dîner de gala exclusif', 'Rencontre avec les speakers'],
  },
];

const parseTicketBenefits = (benefits: unknown): string[] => {
  if (!benefits) return [];
  if (Array.isArray(benefits)) return benefits.filter((item) => typeof item === 'string');
  if (typeof benefits === 'string') {
    try {
      const parsed = JSON.parse(benefits);
      if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string');
      return [parsed.toString()];
    } catch {
      return [benefits];
    }
  }
  return [];
};

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Impossible de lire le fichier comme DataURL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const createImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err);
    image.src = src;
  });

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Impossible de créer le blob depuis le canvas'));
    }, 'image/jpeg', quality);
  });

const compressImage = async (file: File, maxSizeKB: number = 500): Promise<File> => {
  if (file.size <= maxSizeKB * 1024) return file;

  const dataUrl = await readFileAsDataURL(file);
  const image = await createImage(dataUrl);

  let width = image.width;
  let height = image.height;
  const maxDimension = Math.max(width, height);
  if (maxDimension > 1920) {
    const scale = 1920 / maxDimension;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible d’obtenir le contexte de dessin');

  const draw = (w: number, h: number) => {
    canvas.width = w;
    canvas.height = h;
    context.clearRect(0, 0, w, h);
    context.drawImage(image, 0, 0, w, h);
  };

  draw(width, height);
  const targetSize = maxSizeKB * 1024;
  let quality = 0.92;
  let blob = await toBlob(canvas, quality);

  while (blob.size > targetSize && quality > 0.25) {
    quality -= 0.1;
    blob = await toBlob(canvas, quality);
  }

  while (blob.size > targetSize && (width > 600 || height > 600)) {
    width = Math.round(width * 0.9);
    height = Math.round(height * 0.9);
    draw(width, height);
    quality = Math.max(0.25, quality - 0.05);
    blob = await toBlob(canvas, quality);
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_+/g, '_');
  const extension = '.jpg';
  const baseName = cleanName.replace(/\.[^/.]+$/, '');
  const outputName = `${baseName}${extension}`;

  return new File([blob], outputName, { type: 'image/jpeg' });
};

const storageKey = (eventId: string) => `landing-page-${eventId}`;

// Parseur adaptatif pour gérer l'ancien format (objet) ou le nouveau format (tableau) venant de la BDD
const parseSocialLinks = (raw: unknown): SocialLinkItem[] => {
  if (!raw) return defaultData.socialLinks;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && item.platform && typeof item.url === 'string');
    }
    if (typeof parsed === 'object' && parsed !== null) {
      // Conversion de l'ancien format { facebook: '...', instagram: '...' } vers le nouveau format tableau
      return Object.entries(parsed)
        .filter(([_, url]) => !!url && typeof url === 'string')
        .map(([platform, url]) => ({ platform: platform as any, url: url as string }));
    }
  } catch (e) {
    console.error("Erreur lors du parsing des réseaux sociaux", e);
  }
  return defaultData.socialLinks;
};

const normalizeLandingData = (payload: any): LandingPageData => ({
  ...defaultData,
  ...payload,
  templateStyle: payload.template_style ?? payload.templateStyle ?? defaultData.templateStyle,
  themePreset: payload.theme_preset ?? payload.themePreset ?? defaultData.themePreset,
  heroTitle: payload.hero_title ?? payload.heroTitle ?? payload.title ?? defaultData.heroTitle,
  heroSubtitle: payload.hero_subtitle ?? payload.heroSubtitle ?? payload.subtitle ?? defaultData.heroSubtitle,
  heroImage: payload.hero_image ?? payload.heroImage ?? defaultData.heroImage,
  aboutImage: payload.about_image ?? payload.aboutImage ?? defaultData.aboutImage,
  customButtonText: payload.custom_button_text ?? payload.customButtonText ?? defaultData.customButtonText,
  publicDescription: payload.public_description ?? payload.publicDescription ?? defaultData.publicDescription,
  location: payload.lieu ?? payload.location ?? defaultData.location,
  hideAboutSection: typeof payload.hide_about_section !== 'undefined' ? Boolean(payload.hide_about_section) : Boolean(payload.hideAboutSection ?? defaultData.hideAboutSection),
  contactEmail: payload.contact_email ?? payload.contactEmail ?? defaultData.contactEmail,
  contactPhone: payload.contact_phone ?? payload.contactPhone ?? defaultData.contactPhone,
  socialLinks: parseSocialLinks(payload.social_links ?? payload.socialLinks),
  isPublished: typeof payload.is_published !== 'undefined' ? Boolean(payload.is_published) : Boolean(payload.isPublished ?? defaultData.isPublished),
  visibleTickets: Array.isArray(payload.visible_tickets)
    ? payload.visible_tickets
    : Array.isArray(payload.visibleTickets)
    ? payload.visibleTickets
    : [],
  aboutParagraphs: Array.isArray(payload.about_paragraphs) ? payload.about_paragraphs : Array.isArray(payload.aboutParagraphs) ? payload.aboutParagraphs : defaultData.aboutParagraphs,
});

export default function PublicationBuilder({ eventId, eventName: initialEventName, onBack }: { eventId?: string | null; eventName?: string; onBack?: () => void }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ eventId: string }>();
  const builderEventId = eventId ?? params.eventId ?? null;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [landingData, setLandingData] = useState<LandingPageData>(defaultData);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [aboutFile, setAboutFile] = useState<File | null>(null);
  const [aboutPreview, setAboutPreview] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>(initialEventName ?? 'Événement');
  const [ticketTypes, setTicketTypes] = useState<TicketCard[]>([]);
  const [ticketTypesLoading, setTicketTypesLoading] = useState(false);
  const [ticketTypesError, setTicketTypesError] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'design' | 'content' | 'tickets' | 'contacts'>('design');

  const canSave = !!builderEventId;
  const handleBack = onBack ?? (() => navigate('/publication'));

  useEffect(() => {
    if (!builderEventId) return;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey(builderEventId)) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LandingPageData;
        setLandingData(normalizeLandingData(parsed));
      } catch {
        setLandingData(defaultData);
      }
    }
  }, [builderEventId]);

  useEffect(() => {
    if (!builderEventId || !session?.access_token) return;
    const loadLandingPage = async () => {
      setLoading(true);
      try {
        const response = await authAPI.getEventLandingPage(builderEventId, session.access_token);
        if (response.success && response.landingPage) {
          setLandingData((prev) => ({
            ...normalizeLandingData(response.landingPage),
            visibleTickets:
              response.landingPage.visible_tickets ??
              response.landingPage.visibleTickets ??
              prev.visibleTickets,
          }));
          setHeroFile(null);
          setHeroPreview(null);
          setAboutFile(null);
          setAboutPreview(null);
        }
      } catch (err) {
        console.error('PublicationBuilder loadLandingPage', err);
      } finally {
        setLoading(false);
      }
    };
    loadLandingPage();
  }, [builderEventId, session]);

  useEffect(() => {
    const loadEventName = async () => {
      if (!session?.access_token || !builderEventId) return;
      try {
        const orgRes = await authAPI.getMyOrganization(session.access_token);
        if (!orgRes.success || !orgRes.organization) return;
        setOrganizationId(orgRes.organization.id);

        if (initialEventName) return;

        const evRes = await authAPI.getEvents(orgRes.organization.id, session.access_token);
        if (!evRes.success) return;
        const event = (evRes.events || []).find((e: any) => e.id === builderEventId);
        if (event) {
          setEventName(event.title || event.name || 'Événement');
          setLandingData((prev) => ({ ...prev, location: event.location || prev.location }));

          // Générer automatiquement dateText à partir de start_date et end_date
          if (event.start_date && event.end_date) {
            const startDate = new Date(event.start_date);
            const endDate = new Date(event.end_date);

            const startDay = startDate.getDate();
            const endDay = endDate.getDate();
            const month = startDate.toLocaleString('fr-FR', { month: 'long' }).toUpperCase();
            const year = startDate.getFullYear();

            const generatedDateText = `${startDay}-${endDay} ${month} ${year}`;
            setLandingData((prev) => ({ ...prev, dateText: generatedDateText }));
          }
        }
      } catch (err) {
        console.error('PublicationBuilder loadEventName', err);
      }
    };
    loadEventName();
  }, [builderEventId, session, initialEventName]);

  useEffect(() => {
    if (!builderEventId || !session?.access_token) return;

    const loadTicketTypes = async () => {
      setTicketTypesLoading(true);
      setTicketTypesError('');
      try {
        const response = await authAPI.getTicketTypes(builderEventId, session.access_token);
        if (!response.success) {
          throw new Error(response.error || 'Impossible de charger les types de billets');
        }

        const rawTicketTypes = response.ticket_types || [];
        const mapped = rawTicketTypes.map((ticket: any) => ({
          id: ticket.id,
          badge: ticket.name || ticket.title || 'Billet',
          title: ticket.name || ticket.title || 'Billet',
          price: ticket.price != null ? String(ticket.price) : '0',
          currency: ticket.currency || 'Ar',
          bulletPoints: parseTicketBenefits(ticket.benefits),
          numericPrice: ticket.price != null ? Number(ticket.price) : 0,
          featured: false,
        }));

        setTicketTypes(mapped);

        const activeTicketNames = rawTicketTypes
          .filter((ticket: any) => ticket.is_active !== false)
          .map((ticket: any) => ticket.name || ticket.title || 'Billet');

        setLandingData((prev) => ({
          ...prev,
          visibleTickets: activeTicketNames,
        }));
      } catch (error) {
        console.error('PublicationBuilder loadTicketTypes', error);
        setTicketTypesError('Impossible de charger les types de billets');
      } finally {
        setTicketTypesLoading(false);
      }
    };

    loadTicketTypes();
  }, [builderEventId, session]);

  const handleSave = async () => {
    if (!builderEventId || !session?.access_token) return;
    setLoading(true);
    setMessage('');

    try {
      let heroImage = landingData.heroImage;
      let aboutImage = landingData.aboutImage;

      if (heroFile) {
        const compressedHero = await compressImage(heroFile, 500);
        const heroDataUrl = await readFileAsDataURL(compressedHero);
        const heroBase64 = heroDataUrl.split(',')[1] ?? heroDataUrl;
        const heroPathPrefix = organizationId ? organizationId : builderEventId;
        const heroFilePath = `${heroPathPrefix}/${Date.now()}_${compressedHero.name}`;
        const heroUpload = await authAPI.uploadLandingImage(
          builderEventId,
          heroFilePath,
          heroBase64,
          session.access_token,
          compressedHero.type
        );
        if (!heroUpload.success) throw new Error(heroUpload.error || 'Erreur upload image vitrine');
        heroImage = heroUpload.publicUrl || heroUpload.path || heroImage;
      }

      if (aboutFile) {
        const compressedAbout = await compressImage(aboutFile, 500);
        const aboutDataUrl = await readFileAsDataURL(compressedAbout);
        const aboutBase64 = aboutDataUrl.split(',')[1] ?? aboutDataUrl;
        const aboutPathPrefix = organizationId ? organizationId : builderEventId;
        const aboutFilePath = `${aboutPathPrefix}/${Date.now()}_${compressedAbout.name}`;
        const aboutUpload = await authAPI.uploadLandingImage(
          builderEventId,
          aboutFilePath,
          aboutBase64,
          session.access_token,
          compressedAbout.type
        );
        if (!aboutUpload.success) throw new Error(aboutUpload.error || 'Erreur upload image À propos');
        aboutImage = aboutUpload.publicUrl || aboutUpload.path || aboutImage;
      }

      const validSocialLinks = landingData.socialLinks.filter((link) => {
        return (
          typeof link.platform === 'string' &&
          ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'twitter', 'website'].includes(link.platform) &&
          typeof link.url === 'string' &&
          link.url.trim().length > 0
        );
      });

      const payload = {
        eventId: builderEventId,
        title: landingData.title,
        heroTitle: landingData.heroTitle,
        heroSubtitle: landingData.heroSubtitle,
        customButtonText: landingData.customButtonText,
        dateText: landingData.dateText,
        publicDescription: landingData.publicDescription,
        heroImage,
        aboutTitle: landingData.aboutTitle,
        aboutParagraphs: landingData.hideAboutSection ? [] : landingData.aboutParagraphs.filter(Boolean),
        aboutImage,
        contactEmail: landingData.contactEmail,
        contactPhone: landingData.contactPhone,
        socialLinks: validSocialLinks,
        templateStyle: landingData.templateStyle,
        themePreset: landingData.themePreset,
        hideAboutSection: landingData.hideAboutSection,
      };

      const response = await authAPI.saveEventLandingPage(builderEventId, payload, session.access_token);
      if (!response.success) throw new Error(response.error || 'Erreur de sauvegarde');

      // Update ticket types is_active status based on visibleTickets
      await authAPI.updateTicketTypesActive(builderEventId, landingData.visibleTickets, session.access_token);

      setLandingData((prev) => ({
        ...prev,
        heroImage,
        aboutImage,
      }));
      setHeroFile(null);
      setAboutFile(null);

      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey(builderEventId), JSON.stringify({ ...landingData, heroImage, aboutImage, savedAt: new Date().toISOString() }));
      }
      setMessage('La page a été enregistrée via le backend.');
    } catch (err) {
      console.error('PublicationBuilder save error', err);
      setMessage('La sauvegarde a échoué côté backend (Sauvegarde locale effectuée).');
    } finally {
      setLoading(false);
    }
  };

  const toggleTicketVisibility = (ticketTitle: string) => {
    setLandingData((prev) => {
      const isVisible = prev.visibleTickets.includes(ticketTitle);
      const updated = isVisible
        ? prev.visibleTickets.filter((t) => t !== ticketTitle)
        : [...prev.visibleTickets, ticketTitle];
      return { ...prev, visibleTickets: updated };
    });
  };

  // Fonctions de gestion dynamique de la liste des réseaux sociaux
  const addSocialLink = () => {
    setLandingData((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { platform: 'facebook', url: '' }],
    }));
  };

  const updateSocialLink = (index: number, key: keyof SocialLinkItem, value: string) => {
    setLandingData((prev) => {
      const updated = [...prev.socialLinks];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, socialLinks: updated };
    });
  };

  const removeSocialLink = (index: number) => {
    setLandingData((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index),
    }));
  };

  const availableTickets = ticketTypes.length > 0 ? ticketTypes : defaultTickets;
  const filteredTickets = availableTickets.filter((ticket) =>
    landingData.visibleTickets.includes(ticket.title)
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      {/* Header Panel */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="material-symbols-outlined">arrow_back</span>Retour
            </button>
            <h1 className="mt-4 text-headline-lg font-bold text-on-surface">Éditeur de publication</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">Personnalisez la landing page de "{eventName}".</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || loading}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            {message && <span className="text-sm text-on-surface-variant">{message}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,420px)_1fr]">
        
        {/* LEFT PANEL */}
        <div className="flex flex-col gap-6 h-screen overflow-y-auto pr-2">
          <div className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-base font-semibold text-on-surface">{eventName}</span>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={landingData.isPublished}
                  onChange={(e) => setLandingData((prev) => ({ ...prev, isPublished: e.target.checked }))}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus:outline-none"></div>
              </label>
            </div>
          </div>

          <div className="flex border-b border-outline-variant bg-surface p-1 rounded-2xl gap-1">
            {(['design', 'content', 'tickets', 'contacts'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-xl py-2.5 text-center text-xs font-bold capitalize transition-all ${activeTab === tab ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                {tab === 'content' ? 'Contenu' : tab === 'tickets' ? 'Billets' : tab}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-outline-variant bg-surface p-6 shadow-sm min-h-[400px]">
            {activeTab === 'design' && (
              <div className="space-y-5">
                <h3 className="text-headline-sm font-semibold text-on-surface">Style & Identité</h3>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Style de template</span>
                  <select
                    value={landingData.templateStyle}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, templateStyle: e.target.value as any }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                  >
                    <option value="default">Default Layout</option>
                    <option value="compact">Compact Template</option>
                    <option value="split">Split Layout</option>
                  </select>
                </label>
                <div>
                  <span className="text-sm font-medium text-on-surface">Ambiance de couleur</span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['indigo', 'cyberpunk', 'forest', 'crimson', 'amber'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setLandingData((prev) => ({ ...prev, themePreset: preset }))}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition border capitalize ${landingData.themePreset === preset ? 'bg-primary text-on-primary border-primary' : 'bg-white border-outline-variant hover:bg-gray-50'}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-4">
                <h3 className="text-headline-sm font-semibold text-on-surface">Contenu En-tête (Hero)</h3>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Titre de l'événement (affiché en haut)</span>
                  <input
                    value={landingData.title}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                    placeholder="ex: Sommet de l'Innovation Logistique"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Grand titre du héro</span>
                  <input
                    value={landingData.heroTitle}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, heroTitle: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                    placeholder="Grand titre affiché dans la bannière"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Sous-titre accroche</span>
                  <textarea
                    value={landingData.heroSubtitle}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                    rows={2}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Libellé du bouton</span>
                  <input
                    value={landingData.customButtonText}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, customButtonText: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Image vitrine (téléverser)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0] ?? null;
                      setHeroFile(f);
                      if (f) {
                        try {
                          const dataUrl = await readFileAsDataURL(f);
                          setHeroPreview(dataUrl);
                        } catch (error) {
                          console.warn('Impossible de prévisualiser l’image vitrine', error);
                          setHeroPreview(null);
                        }
                      } else {
                        setHeroPreview(null);
                      }
                    }}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-1 text-body-md shadow-sm outline-none focus:border-primary"
                  />
                  {landingData.heroImage && !heroFile && (
                    <p className="text-xs text-on-surface-variant mt-2">Image actuelle: {landingData.heroImage}</p>
                  )}
                  {heroFile && (
                    <p className="text-xs text-on-surface-variant mt-2">Fichier sélectionné: {heroFile.name}</p>
                  )}
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Description publique (sous le héro)</span>
                  <textarea
                    value={landingData.publicDescription}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, publicDescription: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                    rows={3}
                    placeholder="Description courte affichée sous le héro (ex: Plongez dans une expérience immersive...)"
                  />
                </label>
                <hr className="my-4 border-outline-variant" />
                <h3 className="text-headline-sm font-semibold text-on-surface">Section "À propos"</h3>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Titre de la section</span>
                  <input
                    type="text"
                    value={landingData.aboutTitle}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, aboutTitle: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Contenu du paragraphe</span>
                  <textarea
                    value={landingData.aboutParagraphs.join('\n') || ''}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, aboutParagraphs: e.target.value.split('\n').filter(Boolean) }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                    rows={3}
                    placeholder="Entrez le texte de la section. Utilisez des sauts de ligne pour plusieurs paragraphes."
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Image section À propos (téléverser)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0] ?? null;
                      setAboutFile(f);
                      if (f) {
                        try {
                          const dataUrl = await readFileAsDataURL(f);
                          setAboutPreview(dataUrl);
                        } catch (error) {
                          console.warn('Impossible de prévisualiser l’image À propos', error);
                          setAboutPreview(null);
                        }
                      } else {
                        setAboutPreview(null);
                      }
                    }}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-1 text-body-md shadow-sm outline-none focus:border-primary"
                  />
                  {landingData.aboutImage && !aboutFile && (
                    <p className="text-xs text-on-surface-variant mt-2">Image actuelle: {landingData.aboutImage}</p>
                  )}
                  {aboutFile && (
                    <p className="text-xs text-on-surface-variant mt-2">Fichier sélectionné: {aboutFile.name}</p>
                  )}
                </label>
                <label className="flex items-center gap-3 mt-2">
                  <input
                    type="checkbox"
                    checked={landingData.hideAboutSection}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, hideAboutSection: e.target.checked }))}
                    className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-on-surface">Masquer complètement ce bloc</span>
                </label>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-headline-sm font-semibold text-on-surface">Gestion des Billets</h3>
                  <p className="text-xs text-on-surface-variant">Cochez les catégories de pass à afficher.</p>
                  {ticketTypesLoading && (
                    <p className="text-xs text-on-surface-variant">Chargement des types de billets...</p>
                  )}
                  {ticketTypesError && (
                    <p className="text-xs text-error">{ticketTypesError}</p>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {availableTickets.map((ticket) => {
                    const isChecked = landingData.visibleTickets.includes(ticket.title);
                    return (
                      <div
                        key={ticket.title}
                        onClick={() => toggleTicketVisibility(ticket.title)}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${isChecked ? 'border-primary bg-primary-container/10' : 'border-outline-variant bg-white hover:bg-gray-50'}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-on-surface">{ticket.title}</span>
                          <span className="text-xs text-primary font-medium">{ticket.price} {ticket.currency}</span>
                        </div>
                        <input type="checkbox" checked={isChecked} readOnly className="h-5 w-5 rounded border-outline-variant text-primary" />
                      </div>
                    );
                  })}
                  {availableTickets.length === 0 && (
                    <div className="rounded-2xl border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                      Aucun type de billet trouvé pour cet événement.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <h3 className="text-headline-sm font-semibold text-on-surface">Canaux de support</h3>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Email officiel</span>
                  <input
                    value={landingData.contactEmail}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface">Téléphone</span>
                  <input
                    value={landingData.contactPhone}
                    onChange={(e) => setLandingData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-body-md shadow-sm outline-none focus:border-primary"
                  />
                </label>
                
                <hr className="my-4 border-outline-variant" />
                
                {/* SECTION LISTE DES RÉSEAUX SOCIAUX DYNAMIQUE */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">Réseaux Sociaux</span>
                  <button
                    type="button"
                    onClick={addSocialLink}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition"
                  >
                    <span className="material-symbols-outlined text-sm">add</span> Ajouter
                  </button>
                </div>

                <div className="space-y-3 mt-2 max-h-[260px] overflow-y-auto pr-1">
                  {landingData.socialLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-3 rounded-2xl border border-outline-variant bg-background shadow-sm">
                      <div className={`w-10 h-10 rounded-xl border border-outline-variant flex items-center justify-center ${THEME_ICON_BG[landingData.themePreset] ?? 'bg-slate-700'}`}>
                        <SocialPlatformIcon
                          platform={link.platform}
                          url={link.url}
                          size={22}
                          fgColor="#ffffff"
                        />
                      </div>
                      <select
                        value={link.platform}
                        onChange={(e) => updateSocialLink(idx, 'platform', e.target.value)}
                        className="rounded-xl border border-outline-variant bg-white p-2 text-xs font-semibold shadow-sm outline-none focus:border-primary max-w-[110px]"
                      >
                        {AVAILABLE_PLATFORMS.map((plat) => (
                          <option key={plat.id} value={plat.id}>{plat.icon} {plat.name}</option>
                        ))}
                      </select>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={link.url}
                        onChange={(e) => updateSocialLink(idx, 'url', e.target.value)}
                        className="flex-1 rounded-xl border border-outline-variant bg-white p-2 text-xs shadow-sm outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeSocialLink(idx)}
                        className="text-error/80 hover:text-error p-1 inline-flex items-center"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))}
                  {landingData.socialLinks.length === 0 && (
                    <p className="text-xs text-center text-on-surface-variant py-4 italic">Aucun réseau social configuré.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL : Aperçu en direct */}
        <div className="flex flex-col gap-4 items-start self-start h-auto w-full">
          <div className="rounded-3xl border border-outline-variant bg-surface p-6 shadow-sm w-full flex flex-col">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
              <div>
                <h2 className="text-headline-md font-semibold text-on-surface">Aperçu en direct</h2>
                <p className="text-sm text-on-surface-variant">Visualisez le rendu immédiat de votre page.</p>
              </div>
              <div className="inline-flex rounded-full border border-outline-variant bg-background p-1 self-start">
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${previewMode === 'desktop' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container-high'}`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${previewMode === 'mobile' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container-high'}`}
                >
                  Mobile
                </button>
              </div>
            </div>

            {/* Zone d'affichage adaptative */}
            <div className="w-full bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 flex items-center justify-center overflow-hidden">
              {previewMode === 'desktop' ? (
                /* ÉCRAN PC SIMULÉ AVEC SCALE PROPORTIONNEL */
                <div className="w-full relative aspect-video overflow-hidden rounded-2xl border border-outline-variant bg-background shadow-xl">
                  <div className="absolute inset-0 overflow-y-auto overflow-x-hidden origin-top-left w-[1280px] h-[720px] scale-[0.5] xl:scale-[0.52] 2xl:scale-[0.65] [@media(max-width:1280px)]:scale-[0.45] [@media(max-width:1024px)]:scale-[0.35]">
                    <div className="w-full min-h-full bg-background">
                      <PublicationTemplate
                        {...{
                          title: landingData.title,
                          heroTitle: landingData.heroTitle,
                          heroSubtitle: landingData.heroSubtitle,
                          customButtonText: landingData.customButtonText,
                          dateText: landingData.dateText,
                          publicDescription: landingData.publicDescription,
                          heroImage: heroPreview ?? landingData.heroImage,
                          aboutTitle: landingData.aboutTitle,
                          aboutParagraphs: landingData.hideAboutSection ? [] : landingData.aboutParagraphs.filter(Boolean),
                          aboutImage: aboutPreview ?? landingData.aboutImage,
                          location: landingData.location,
                          tickets: filteredTickets,
                          contactEmail: landingData.contactEmail,
                          contactPhone: landingData.contactPhone,
                          socialLinks: landingData.socialLinks, // Le template recevra le tableau
                          templateStyle: landingData.templateStyle,
                          themePreset: landingData.themePreset,
                          hideAboutSection: landingData.hideAboutSection,
                        }}
                        mode="desktop"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ÉCRAN SMARTPHONE SIMULÉ */
                <div className="w-[340px] h-[580px] rounded-[2.5rem] border-[6px] border-slate-800 bg-background shadow-2xl overflow-y-auto overflow-x-hidden">
                  <PublicationTemplate
                    {...{
                      title: landingData.title,
                      heroTitle: landingData.heroTitle,
                      heroSubtitle: landingData.heroSubtitle,
                      customButtonText: landingData.customButtonText,
                      dateText: landingData.dateText,
                      publicDescription: landingData.publicDescription,
                      heroImage: heroPreview ?? landingData.heroImage,
                      aboutTitle: landingData.aboutTitle,
                      aboutParagraphs: landingData.hideAboutSection ? [] : landingData.aboutParagraphs.filter(Boolean),
                      aboutImage: aboutPreview ?? landingData.aboutImage,
                      location: landingData.location,
                      tickets: filteredTickets,
                      contactEmail: landingData.contactEmail,
                      contactPhone: landingData.contactPhone,
                      socialLinks: landingData.socialLinks,
                      templateStyle: landingData.templateStyle,
                      themePreset: landingData.themePreset,
                      hideAboutSection: landingData.hideAboutSection,
                    }}
                    mode="mobile"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}