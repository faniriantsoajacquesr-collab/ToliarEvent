import { useState, type InputHTMLAttributes } from 'react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const DEFAULT_INPUT_CLASS =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-sm pr-11 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none';

export default function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputClass = className
    ? (className.includes('pr-') ? className : `${className} pr-11`)
    : DEFAULT_INPUT_CLASS;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={inputClass}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        <span className="material-symbols-outlined text-[20px] leading-none">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
