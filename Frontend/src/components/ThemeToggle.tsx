import { useTheme } from '../contexts/ThemeContext';

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`landing-theme-toggle ${className}`}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}
