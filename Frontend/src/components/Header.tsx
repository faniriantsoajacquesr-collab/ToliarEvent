interface HeaderProps {
  toggleMobileSidebar: () => void;
}

export default function Header({ toggleMobileSidebar }: HeaderProps) {
  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant/30 p-4 flex items-center gap-4 md:hidden z-30">
      {/* Bouton Hamburger calé à gauche */}
      <button 
        onClick={toggleMobileSidebar} 
        className="text-on-surface-variant hover:bg-surface-container rounded-lg p-1.5 flex items-center justify-center transition-colors focus:outline-none"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
      </button>
      
      {/* Titre de l'application */}
      <h1 className="font-headline-md text-on-surface font-bold text-lg select-none">
        ToliarEvent
      </h1>
    </header>
  );
}