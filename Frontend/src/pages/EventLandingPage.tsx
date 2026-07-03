import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicationTemplate, { type TicketCard } from '../components/PublicationTemplate';
import TicketPurchaseModal, { type SelectedTicketType } from '../components/TicketPurchaseModal';
import { authAPI } from '../services/authAPI';
import { setDocumentTitle } from '../utils/pageTitles';

const defaultData = {
  title: 'Événement à Toliara',
  heroTitle: 'Présentation de l’événement',
  heroSubtitle: 'Découvrez tous les détails et réservez votre place.',
  customButtonText: 'Acheter un billet',
  dateText: 'Date à venir',
  publicDescription: 'Retrouvez ici les informations officielles et l’ambiance de l’événement.',
  heroImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  aboutTitle: 'À propos de l’événement',
  aboutParagraphs: [],
  aboutImage: '',
  location: 'Toliara, Madagascar',
  contactEmail: 'contact@toliarevent.mg',
  contactPhone: '+261 34 00 000 00',
  templateStyle: 'default' as const,
  themePreset: 'indigo' as const,
  hideAboutSection: false,
};

const parseSocialLinks = (raw: any) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((item) => item?.platform && item?.url);
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .map(([platform, url]) => ({ platform: platform as any, url: url as string }));
  }
  return [];
};

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

const mapTicketTypeToCard = (ticket: any) => ({
  id: ticket.id,
  badge: ticket.name || ticket.title || 'Billet',
  title: ticket.name || ticket.title || 'Billet',
  price: ticket.price != null ? String(ticket.price) : '0',
  currency: ticket.currency || 'Ar',
  bulletPoints: parseTicketBenefits(ticket.benefits),
  numericPrice: ticket.price != null ? Number(ticket.price) : 0,
});

const normalizeLandingPage = (landing: any, event: any, ticketTypes: any[] = []) => ({
  title: landing.title ?? event?.title ?? defaultData.title,
  heroTitle: landing.hero_title ?? landing.heroTitle ?? event?.title ?? defaultData.heroTitle,
  heroSubtitle: landing.hero_subtitle ?? landing.heroSubtitle ?? landing.subtitle ?? defaultData.heroSubtitle,
  customButtonText: landing.custom_button_text ?? landing.customButtonText ?? defaultData.customButtonText,
  dateText:
    landing.date_text ?? landing.dateText ??
    (event?.start_date && event?.end_date
      ? `${new Date(event.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace('.', '')} - ${new Date(event.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : defaultData.dateText),
  publicDescription:
    landing.public_description ?? landing.publicDescription ?? landing.description ?? event?.description ?? defaultData.publicDescription,
  heroImage: landing.hero_image ?? landing.heroImage ?? event?.image_url ?? defaultData.heroImage,
  aboutTitle: landing.about_title ?? landing.aboutTitle ?? defaultData.aboutTitle,
  aboutParagraphs:
    Array.isArray(landing.about_paragraphs)
      ? landing.about_paragraphs
      : Array.isArray(landing.aboutParagraphs)
      ? landing.aboutParagraphs
      : landing.about_text
      ? [landing.about_text]
      : [],
  aboutImage: landing.about_image ?? landing.aboutImage ?? defaultData.aboutImage,
  location: landing.lieu ?? landing.location ?? event?.location ?? defaultData.location,
  contactEmail: landing.contact_email ?? landing.contactEmail ?? defaultData.contactEmail,
  contactPhone: landing.contact_phone ?? landing.contactPhone ?? defaultData.contactPhone,
  socialLinks: parseSocialLinks(landing.social_links ?? landing.socialLinks),
  templateStyle: landing.template_style ?? landing.templateStyle ?? defaultData.templateStyle,
  themePreset: landing.theme_preset ?? landing.themePreset ?? defaultData.themePreset,
  hideAboutSection:
    typeof landing.hide_about_section !== 'undefined'
      ? Boolean(landing.hide_about_section)
      : typeof landing.hideAboutSection !== 'undefined'
      ? Boolean(landing.hideAboutSection)
      : defaultData.hideAboutSection,
  tickets: (ticketTypes || [])
    .filter((ticket) => ticket.is_active !== false)
    .map(mapTicketTypeToCard),
});

export default function EventLandingPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [landingPage, setLandingPage] = useState<any | null>(null);
  const [eventData, setEventData] = useState<any | null>(null);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicketType, setSelectedTicketType] = useState<SelectedTicketType | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const loadLanding = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authAPI.getPublicEventLandingPage(eventId);
        if (!response.success) {
          setError(response.error || 'Impossible de charger la page d’événement.');
          return;
        }

        setLandingPage(response.landingPage ?? null);
        setEventData(response.event ?? null);
        setTicketTypes(Array.isArray(response.ticketTypes) ? response.ticketTypes : []);
      } catch (err) {
        console.error('Erreur chargement landing page publique', err);
        setError('Erreur serveur lors du chargement de la page.');
      } finally {
        setLoading(false);
      }
    };

    loadLanding();
  }, [eventId]);

  useEffect(() => {
    if (!eventData) return;
    const eventTitle = eventData.title || eventData.name || 'Événement';
    setDocumentTitle(`${eventTitle} | ToliarEvent`);
  }, [eventData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="rounded-3xl bg-white shadow-lg border border-slate-200 px-8 py-10 text-center">
          <div className="animate-pulse text-slate-500">Chargement de la page d’événement…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 gap-6">
        <div className="rounded-3xl bg-white shadow-lg border border-slate-200 p-10 text-center max-w-xl">
          <h1 className="text-2xl font-bold mb-4">Erreur de chargement</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition"
            onClick={() => navigate('/evenements')}
          >
            Retour à la liste des événements
          </button>
        </div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 gap-6">
        <div className="rounded-3xl bg-white shadow-lg border border-slate-200 p-10 text-center max-w-xl">
          <h1 className="text-2xl font-bold mb-4">Événement introuvable</h1>
          <p className="text-slate-600 mb-6">L'événement demandé n'existe pas.</p>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition"
            onClick={() => navigate('/evenements')}
          >
            Retour à la liste des événements
          </button>
        </div>
      </div>
    );
  }

  const normalized = normalizeLandingPage(landingPage, eventData, ticketTypes);

  const handleOpenCheckout = (ticket: TicketCard) => {
    if (!ticket.id) return;
    setSelectedTicketType({
      id: String(ticket.id),
      name: ticket.title,
      price: ticket.numericPrice ?? (Number(ticket.price) || 0),
    });
    setIsPurchaseModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-8xl mx-auto px-4 py-8">
        <button
          type="button"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 transition"
          onClick={() => navigate('/evenements')}
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Retour aux événements
        </button>
        <PublicationTemplate
          title={normalized.title}
          heroTitle={normalized.heroTitle}
          heroSubtitle={normalized.heroSubtitle}
          customButtonText={normalized.customButtonText}
          dateText={normalized.dateText}
          publicDescription={normalized.publicDescription}
          heroImage={normalized.heroImage}
          aboutTitle={normalized.aboutTitle}
          aboutParagraphs={normalized.aboutParagraphs}
          aboutImage={normalized.aboutImage}
          location={normalized.location}
          tickets={normalized.tickets}
          contactEmail={normalized.contactEmail}
          contactPhone={normalized.contactPhone}
          socialLinks={normalized.socialLinks}
          templateStyle={normalized.templateStyle}
          themePreset={normalized.themePreset}
          hideAboutSection={normalized.hideAboutSection}
          onBuyTicket={handleOpenCheckout}
        />
      </div>
      <TicketPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        eventId={eventId!}
        ticketType={selectedTicketType}
      />
    </div>
  );
}
