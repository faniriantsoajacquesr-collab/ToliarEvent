interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({ message = 'Chargement en cours...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div className="rounded-3xl bg-surface-container-high px-8 py-10 flex flex-col items-center gap-4 text-center shadow-2xl border border-outline-variant">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-headline-sm font-semibold text-on-surface">{message}</p>
      </div>
    </div>
  );
}
