import type { ReactNode } from 'react';

type AppPageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function AppPageHeader({ title, subtitle, actions }: AppPageHeaderProps) {
  return (
    <div className="app-page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="font-landing-display text-2xl md:text-3xl app-heading">{title}</h1>
        {subtitle && <p className="app-text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
