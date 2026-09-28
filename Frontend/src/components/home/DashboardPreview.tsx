function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}
export default function DashboardPreview() {
  return (
    <figure className="home-dashboard">
      <figcaption className="home-dashboard-bar"><span className="font-landing-display font-bold">ToliarEvent <span className="home-pro-label">PRO</span></span><span className="text-xs landing-text-subtle">Aperçu illustratif</span></figcaption>
      <div className="home-dashboard-body">
        <div className="home-dashboard-nav" aria-hidden="true">{['Événements', 'Équipe', 'Billetterie', 'Planning', 'Finances'].map((label, index) => <span key={label} className={index === 3 ? 'is-selected' : ''}><Icon name={['event', 'group', 'confirmation_number', 'calendar_month', 'account_balance_wallet'][index]} />{label}</span>)}</div>
        <div className="home-dashboard-main">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-7"><div><p className="text-xs landing-text-subtle mb-2">Mon événement / Planning</p><h3 className="font-landing-display text-xl md:text-2xl landing-heading">Tout est prêt pour le jour J.</h3></div><span className="home-preview-status">Préparation en cours</span></div>
          <div className="home-preview-metrics">{[['group', 'Équipe', 'Rôles attribués'], ['qr_code_2', 'Billetterie', 'Billets préparés'], ['payments', 'Finances', 'Budget suivi']].map(([icon, title, text]) => <div key={title}><Icon name={icon} /><span className="font-semibold landing-heading">{title}</span><span className="text-xs landing-text-subtle">{text}</span></div>)}</div>
          <div className="home-preview-tasks"><div className="flex justify-between gap-3 text-xs font-semibold landing-text-subtle pb-3"><span>Préparatifs</span><span>Avancement</span></div>{[['Préparer la billetterie', 'Terminé', '100%'], ['Confirmer les équipes', 'En cours', '72%'], ['Installer l’accueil', 'À venir', '20%']].map(([title, status, width]) => <div className="home-preview-task" key={title}><span className="text-sm landing-heading">{title}</span><div className="home-preview-track"><span style={{ width }} /></div><span className="text-xs landing-text-subtle">{status}</span></div>)}</div>
        </div>
      </div>
    </figure>
  );
}
