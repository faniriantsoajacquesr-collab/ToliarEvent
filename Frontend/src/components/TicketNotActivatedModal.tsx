interface TicketNotActivatedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TicketNotActivatedModal({ isOpen, onClose }: TicketNotActivatedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg rounded-3xl border-4 border-amber-400 bg-white p-8 text-center shadow-2xl"
        role="alertdialog"
        aria-labelledby="ticket-not-activated-title"
        aria-describedby="ticket-not-activated-desc"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <span className="material-symbols-outlined text-5xl text-amber-600">warning</span>
        </div>

        <h2 id="ticket-not-activated-title" className="text-2xl font-black uppercase tracking-wide text-amber-700">
          Billet non activé
        </h2>

        <p id="ticket-not-activated-desc" className="mt-4 text-lg font-semibold leading-relaxed text-gray-800">
          Ce billet n&apos;est pas encore activé et n&apos;a donc pas été payé.
        </p>

        <p className="mt-3 text-sm text-gray-500">
          Utilisez d&apos;abord l&apos;action « Activer un billet » après encaissement du paiement.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-bold text-white transition hover:bg-amber-600"
        >
          Compris
        </button>
      </div>
    </div>
  );
}
