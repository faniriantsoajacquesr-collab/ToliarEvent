const ITEMS = [
  'Billetterie QR sécurisée',
  'Gestion staff en temps réel',
  'Comptabilité automatisée',
  'Anti-fraude à l\'entrée',
  'Suivi par jalons',
  'Export impression bulk',
  'Tableau de bord live',
  'Toliara · Madagascar',
];

export default function MarqueeStrip() {
  const track = [...ITEMS, ...ITEMS];

  return (
    <div className="landing-marquee-wrap" aria-hidden="true">
      <div className="landing-marquee-track">
        {track.map((item, i) => (
          <span key={`${item}-${i}`} className="landing-marquee-item">
            <span className="landing-marquee-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
