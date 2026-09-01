import RevealOnScroll from './RevealOnScroll';

type CtaBandSectionProps = {
  onCreateEvent: () => void;
  onBrowseEvents: () => void;
};

export default function CtaBandSection({ onCreateEvent, onBrowseEvents }: CtaBandSectionProps) {
  return (
    <section className="landing-section relative" aria-labelledby="cta-band-heading">
      <div className="landing-container">
        <RevealOnScroll direction="scale">
          <div className="relative overflow-hidden rounded-3xl px-8 py-16 md:px-20 md:py-24 text-center">
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  'linear-gradient(135deg, #1e3a8a 0%, #312e81 40%, #1e1b4b 100%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(245,158,11,0.2) 0%, transparent 50%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-10 pointer-events-none landing-bg-noise"
              aria-hidden="true"
            />

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2
                id="cta-band-heading"
                className="font-landing-display text-3xl md:text-5xl text-white mb-5 leading-[1.08] tracking-tight"
              >
                Votre prochain événement mérite mieux qu&apos;un groupe WhatsApp
              </h2>
              <p className="text-white/55 text-base md:text-lg mb-10 leading-relaxed">
                Rejoignez les organisateurs toliarais qui centralisent billetterie, staff et
                comptabilité sur une seule plateforme.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button type="button" onClick={onCreateEvent} className="landing-btn-primary">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    add_circle
                  </span>
                  Créer mon événement
                </button>
                <button type="button" onClick={onBrowseEvents} className="landing-btn-secondary">
                  Explorer les événements
                </button>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
