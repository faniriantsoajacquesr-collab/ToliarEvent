import { Link } from 'react-router-dom';

interface LegalAcceptanceCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  id?: string;
  openLinksInNewTab?: boolean;
}

function LegalLink({
  to,
  children,
  openInNewTab,
}: {
  to: string;
  children: React.ReactNode;
  openInNewTab?: boolean;
}) {
  const className = 'text-primary underline hover:text-primary/80';

  if (openInNewTab) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export default function LegalAcceptanceCheckbox({
  checked,
  onChange,
  error,
  id = 'legal-acceptance',
  openLinksInNewTab = true,
}: LegalAcceptanceCheckboxProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className={`flex items-start gap-3 cursor-pointer ${error ? 'text-red-600' : ''}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant text-primary focus:ring-primary"
        />
        <span className="text-sm leading-snug text-on-surface-variant">
          J&apos;accepte la{' '}
          <LegalLink to="/confidentialite" openInNewTab={openLinksInNewTab}>
            Politique de confidentialité
          </LegalLink>{' '}
          et les{' '}
          <LegalLink to="/cgu" openInNewTab={openLinksInNewTab}>
            Conditions d&apos;utilisation
          </LegalLink>
          .
        </span>
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
