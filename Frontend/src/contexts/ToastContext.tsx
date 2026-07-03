import { createContext, useContext, useState, type ReactNode } from 'react';

type Toast = { message: string; visible: boolean; type?: 'success' | 'error' };

type ToastContextValue = {
  showToast: (message: string, type?: 'success' | 'error') => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>({ message: '', visible: false, type: 'success' });
  let timer: number | undefined;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, visible: true, type });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setToast({ message: '', visible: false, type }), 3500);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`fixed bottom-xl right-xl px-lg py-md rounded-xl shadow-2xl z-[110] transition-all duration-300 flex items-center gap-md ${
          toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
        style={{ background: toast.type === 'error' ? 'rgba(220,38,38,0.95)' : 'rgba(16,185,129,0.95)', color: '#fff' }}
        aria-live="polite"
      >
        <span className="material-symbols-outlined">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </ToastContext.Provider>
  );
}
