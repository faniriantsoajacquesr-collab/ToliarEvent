import type { ReactNode } from 'react';
import LandingBackground from './home/LandingBackground';
import ThemeToggle from './ThemeToggle';

type OnboardingLayoutProps = {
  children: ReactNode;
};

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="landing-page min-h-screen relative">
      <LandingBackground />
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
