import type { ReactNode } from 'react';
import LandingBackground from './home/LandingBackground';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

export default function AuthShell({ title, subtitle, children, footer, wide }: AuthShellProps) {
  return (
    <div className="relative py-10 md:py-14 min-h-[70vh] flex items-center justify-center px-gutter overflow-hidden">
      <LandingBackground />
      <div
        className={`relative z-10 w-full landing-glass-card rounded-2xl p-7 md:p-9 ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="text-center mb-7">
          <p className="landing-eyebrow mb-4 justify-center">ToliarEvent</p>
          <h1 className="font-landing-display text-2xl md:text-3xl landing-heading mb-2">{title}</h1>
          {subtitle && <p className="landing-text-muted text-sm">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-7 pt-6 border-t border-[var(--landing-border)]">{footer}</div>}
      </div>
    </div>
  );
}
