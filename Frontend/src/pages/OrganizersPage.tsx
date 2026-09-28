import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ContactSection from '../components/home/ContactSection';
import ticketsVisual from '../assets/demo/tickets-print-visual.png';
import publicationDemo from '../assets/demo/event-page-demo.png';
import scanVisual from '../assets/demo/ticket-scan-visual.png';
import heroImage from '../assets/hero.png';
import './Home.css';
import './OrganizersPage.css';

const modules = [
  { icon: 'group', label: 'Équipe', title: 'Une équipe qui sait quoi faire.', text: 'Centralisez vos membres, examinez les candidatures et attribuez les postes pour chaque événement.', items: ['Membres et rôles', 'Postes et candidatures', 'Compétences des profils'] },
  { icon: 'calendar_month', label: 'Planning', title: 'Des préparatifs qui avancent.', text: 'Répartissez les tâches, fixez les dates et visualisez le travail à venir dans votre planning.', items: ['Tâches et responsables', 'Vue Gantt', 'Suivi des statuts et retards'] },
  { icon: 'account_balance_wallet', label: 'Finances', title: 'Vos chiffres, au même endroit.', text: 'Consignez les recettes et les dépenses de votre événement pour suivre son bilan financier.', items: ['Recettes et dépenses', 'Catégories de transactions', 'Journal et totaux par événement'] },
];
const questions = [
  ['À qui s’adresse ToliarEvent Pro ?', 'Aux organisateurs de concerts, événements culturels, rencontres gaming, ateliers et autres rendez-vous à Toliara. Votre organisation regroupe ses événements et son équipe dans un espace commun.'],
  ['Comment commencer ?', 'Créez votre compte, confirmez votre adresse e-mail et complétez votre profil. Créez ensuite votre organisation ou rejoignez-en une avec son code. Une nouvelle organisation peut nécessiter une validation avant son activation.'],
  ['Comment fonctionnent les paiements Mobile Money ?', 'L’acheteur effectue son paiement auprès du moyen indiqué, puis renseigne sa référence de transaction. Votre administration vérifie le paiement et valide la commande. La confirmation auprès de l’opérateur n’est pas automatique.'],
  ['Puis-je imprimer les billets ?', 'Oui. Vous pouvez personnaliser les billets et générer des PDF avec QR code, puis utiliser les outils de scan pour leur activation et le contrôle d’entrée.'],
  ['Faut-il une connexion Internet ?', 'Oui. La gestion des événements, des commandes et le contrôle des billets utilisent le serveur. Prévoyez une connexion sur le lieu de l’événement.'],
];
function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

export default function OrganizersPage() {
  const navigate = useNavigate();
  const { isAuthenticated, getAppEntryPath, setAuthModalOpen } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const createEvent = () => {
    if (isAuthenticated) navigate(getAppEntryPath());
    else setAuthModalOpen(true, 'signup');
  };
  return (
    <div className="landing-page home-public pro-page">
      <section className="pro-hero" aria-labelledby="pro-title">
        <div className="landing-container pro-hero-grid">
          <div>
            <p className="landing-eyebrow mb-6">Accès anticipé · Gratuit pour les étudiants</p>
            <h1 id="pro-title" className="font-landing-display landing-heading">Vous créez<br />le moment.<br /><span className="home-city">Organisez la suite.</span></h1>
            <p className="pro-lead landing-text-muted">Publiez votre événement, gérez votre billetterie et coordonnez votre organisation depuis un seul espace.</p>
            <ul className="pro-hero-capabilities"><li>Publiez votre événement</li><li>Vendez en ligne &amp; sur place</li><li>Contrôlez les entrées</li></ul>
            <div className="pro-actions"><button type="button" className="landing-btn-primary" onClick={createEvent}>{isAuthenticated ? 'Accéder à mon espace' : 'Demander un accès anticipé'} <Icon name="arrow_forward" /></button><a href="#parcours-pro" className="landing-btn-secondary">Découvrir ToliarEvent</a></div>
            <p className="pro-local landing-text-muted"><Icon name="location_on" /> Accès sur invitation · Places limitées pendant la phase de test</p>
          </div>
          <div className="home-logo-scene"><img src={heroImage} alt="ToliarEvent — Gérez, organisez, publiez, vivez l’événement." width={1254} height={1254} fetchPriority="high" className="home-logo-art" /></div>
        </div>
      </section>
      <section id="parcours-pro" className="pro-journey landing-container" aria-labelledby="pro-journey-title">
        <div className="pro-section-intro"><p className="landing-eyebrow">De l’annonce au jour J</p><h2 id="pro-journey-title" className="font-landing-display landing-heading">Trois moments.<br /><span className="home-city">Un seul espace.</span></h2><p className="landing-text-muted">Tout ce qu’il faut pour publier, vendre et accueillir votre public.</p></div>
        <ol className="pro-moments">
          <li className="pro-moment pro-moment-publish">
            <span className="pro-moment-number">01 / Faites passer le mot</span>
            <h3 className="font-landing-display landing-heading">Publiez.</h3>
            <p className="landing-text-muted">Votre programme, vos visuels et vos offres de billets sur une page à partager.</p>
            <figure className="pro-moment-visual pro-moment-visual-publish"><img src={publicationDemo} alt="Page publique fictive du Festival des Talents avec affiche et achat de billets." loading="lazy" decoding="async" /></figure>
          </li>
          <li className="pro-moment pro-moment-sell">
            <span className="pro-moment-number">02 / Remplissez la salle</span>
            <h3 className="font-landing-display landing-heading">Vendez.</h3>
            <p className="landing-text-muted">En ligne ou sur place. Générez vos séries de billets QR uniques, numérotés et prêts à imprimer.</p>
            <figure className="pro-moment-visual pro-moment-visual-sell"><img src={ticketsVisual} alt="Planche PDF de billets du Festival des Talents, avec un QR code sur chaque billet." width="1536" height="1024" loading="lazy" decoding="async" /></figure>
          </li>
          <li className="pro-moment pro-moment-scan">
            <span className="pro-moment-number">03 / Place à l’événement</span>
            <h3 className="font-landing-display landing-heading">Scannez.</h3>
            <p className="landing-text-muted">Contrôlez les billets activés depuis un téléphone. Un billet déjà utilisé est signalé au scan.</p>
            <figure className="pro-moment-visual pro-moment-visual-scan"><img src={scanVisual} alt="Un téléphone scanne le QR code d’un billet à l’entrée d’un événement." width="1024" height="1536" loading="lazy" decoding="async" /></figure>
          </li>
        </ol>
      </section>
      <section id="billetterie-pro" className="pro-ticketing pro-star" aria-labelledby="pro-ticketing-title">
        <div className="landing-container">
          <div className="pro-star-heading"><div className="pro-section-intro"><p className="landing-eyebrow">Du web au terrain</p><h2 id="pro-ticketing-title" className="font-landing-display landing-heading">Une billetterie.<br /><span className="home-city">Deux façons de vendre.</span></h2></div>
            <div className="pro-sales-options"><article className="pro-sales-card"><Icon name="language" /><h3 className="landing-heading">En ligne</h3><p className="landing-text-muted">Le public choisit son offre et commande depuis votre page événement.</p></article><article className="pro-sales-card"><Icon name="confirmation_number" /><h3 className="landing-heading">Sur place</h3><p className="landing-text-muted">Imprimez vos billets QR en lot et activez-les lors de la vente.</p></article></div>
          </div>
        </div>
      </section>
      <section id="outils-pro" className="pro-tools landing-container" aria-labelledby="pro-tools-title">
        <div className="pro-section-intro"><p className="landing-eyebrow">Et ce n’est que la billetterie.</p><h2 id="pro-tools-title" className="font-landing-display landing-heading">Toute votre organisation<br /><span className="home-city">vit aussi sur ToliarEvent.</span></h2><p className="landing-text-muted">Une équipe coordonnée. Un planning partagé. Vos finances à portée de main.</p></div>
        <div className="pro-module-grid">{modules.map((module) => <article className="pro-module" key={module.label}><div className="pro-module-label"><Icon name={module.icon} />{module.label}</div><h3 className="font-landing-display landing-heading">{module.title}</h3><p className="landing-text-muted">{module.text}</p></article>)}</div>
      </section>
      <section className="landing-container pro-faq" aria-labelledby="pro-faq-title"><div><p className="landing-eyebrow mb-5">Quelques repères</p><h2 id="pro-faq-title" className="font-landing-display landing-heading">Avant de vous lancer.</h2></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p className="landing-text-muted">{answer}</p></details>)}</div></section>
      <section className="landing-container pro-final" aria-labelledby="pro-final-title">
        <div className="pro-student-invite">
          <div><p className="landing-eyebrow mb-5">Étudiants · Accès anticipé gratuit</p><h2 id="pro-final-title" className="font-landing-display landing-heading">Vous êtes étudiant ?<br /><span className="home-city">Vous avez un événement à gérer ?</span></h2><p className="landing-text-muted pro-student-copy">Pendant la phase d’accès anticipé, ToliarEvent Pro est <strong>gratuit pour les étudiants et jeunes organisateurs sélectionnés.</strong></p></div>
          <div className="pro-student-contact"><Icon name="school" /><p className="landing-text-muted">Contactez-nous pour discuter de votre projet.</p><button type="button" className="landing-btn-primary" onClick={() => setAuthModalOpen(true, 'signup')}>Demander un accès <Icon name="arrow_forward" /></button></div>
        </div>
      </section>
      <ContactSection />
    </div>
  );
}
