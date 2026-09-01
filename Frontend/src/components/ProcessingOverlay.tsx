interface ProcessingOverlayProps {
  message?: string;
}

/** Blocking overlay for short-lived actions (scan, export…) — not for data fetching. */
export default function ProcessingOverlay({ message = 'Traitement en cours…' }: ProcessingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="rounded-2xl app-card px-8 py-7 flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-12 h-12 border-[3px] border-primary/25 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-semibold app-heading">{message}</p>
      </div>
    </div>
  );
}
