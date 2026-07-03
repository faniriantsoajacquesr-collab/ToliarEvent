import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileSidebarOpen?: boolean;
  toggleMobileSidebar?: () => void;
}

const tabs = [
  { id: 'events', label: 'Events', icon: 'event', path: '/events' },
  { id: 'publication', label: 'Publication', icon: 'newspaper', path: '/publication' },
  { id: 'tickets', label: 'Tickets', icon: 'confirmation_number', path: '/tickets' },
  { id: 'orders', label: 'Commandes', icon: 'shopping_cart', path: '/commandes', adminOnly: true as const },
  { id: 'staff', label: 'Staff', icon: 'group', path: '/staff' },
  { id: 'planning', label: 'Planning', icon: 'calendar_month', path: '/planning' },
  { id: 'finance', label: 'Finance', icon: 'payments', path: '/finance' },
];

function getActiveTabId(pathname: string): string {
  if (pathname.startsWith('/publication-builder')) return 'publication';
  const match = tabs.find((tab) => pathname === tab.path);
  return match?.id ?? 'events';
}

export default function DashboardSidebar({ isCollapsed, onToggle, isMobileSidebarOpen = false, toggleMobileSidebar }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeTab = getActiveTabId(pathname);

  const isSimpleStaff = !!user?.role && user.role.toString().toLowerCase() === 'staff';
  const isAdmin = user?.role?.toString().toLowerCase() === 'admin';

  const visibleTabs = tabs.filter((tab) => {
    if (isSimpleStaff && tab.id === 'staff') return false;
    if (!isAdmin && (tab.id === 'publication' || tab.id === 'orders')) return false;
    return true;
  });

  const handleTabClick = (path: string) => {
    navigate(path);
    toggleMobileSidebar?.();
  };

  const mobileBase = `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 md:hidden`;
  const mobileState = isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full';
  const desktopBase = `h-full w-[var(--sidebar-width)] fixed left-0 top-0 md:block hidden bg-surface-container-lowest border-r border-outline-variant shadow-sm flex flex-col py-lg px-md z-30 transition-all duration-300 overflow-hidden`;

  const tabClassName = (tabId: string, collapsed: boolean) => {
    const isActive = activeTab === tabId;
    const base = `w-full flex items-center ${collapsed ? 'justify-center' : 'gap-md'} p-md rounded-lg transition-all`;
    if (isActive) {
      return `${base} text-primary font-bold bg-primary/10 ${collapsed ? 'ring-2 ring-primary/40' : 'border-l-4 border-primary'}`;
    }
    return `${base} text-on-surface-variant hover:bg-surface-container-low ${collapsed ? '' : 'border-l-4 border-transparent'}`;
  };

  return (
    <>
      {/* Mobile off-canvas */}
      <aside className={`${mobileBase} ${mobileState} bg-surface-container-lowest border-r border-outline-variant shadow-sm flex flex-col py-lg px-md overflow-auto`}>
        <div className="mb-xl flex items-center justify-between">
          <div>
            <h1 className="text-headline-md font-headline-md font-bold text-primary">ToliarEvent</h1>
          </div>
          <button onClick={() => toggleMobileSidebar?.()} className="p-2 rounded-md">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 space-y-sm">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.path)}
              className={tabClassName(tab.id, false)}
              title={tab.label}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span className="font-label-md">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="pt-lg border-t border-outline-variant space-y-sm">
          <button
            onClick={async () => {
              await logout();
              toggleMobileSidebar?.();
              navigate('/');
            }}
            className="w-full flex items-center gap-md p-md rounded-lg transition-all text-on-surface-variant hover:bg-surface-container-low"
            title="Déconnexion"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-md">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Desktop static sidebar */}
      <aside className={desktopBase}>
        <div className="mb-xl flex items-center justify-between">
          {!isCollapsed && (
            <div className="animate-in fade-in duration-500">
              <h1 className="text-headline-md font-headline-md font-bold text-primary">ToliarEvent</h1>
              <p className="text-label-md text-on-surface-variant opacity-70">Event Logistics</p>
            </div>
          )}
          <button onClick={onToggle} className={`p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-colors ${isCollapsed ? 'mx-auto' : ''}`}>
            <span className="material-symbols-outlined">{isCollapsed ? 'menu_open' : 'menu'}</span>
          </button>
        </div>

        <nav className="flex-1 space-y-sm">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.path)}
              className={tabClassName(tab.id, isCollapsed)}
              title={isCollapsed ? tab.label : ''}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              {!isCollapsed && <span className="font-label-md animate-in fade-in slide-in-from-left-2">{tab.label}</span>}
            </button>
          ))}
        </nav>

        <div className="pt-lg border-t border-outline-variant space-y-sm">
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-md'} p-md rounded-lg transition-all text-on-surface-variant hover:bg-surface-container-low`}
            title={isCollapsed ? 'Déconnexion' : ''}
          >
            <span className="material-symbols-outlined">logout</span>
            {!isCollapsed && <span className="font-label-md animate-in fade-in slide-in-from-left-2">Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
