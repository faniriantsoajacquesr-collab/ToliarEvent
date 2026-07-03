import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import DashboardTopBar from '../components/DashboardTopBar';

import EventManager from './EventManager';
import StaffEventManager from './StaffUX/StaffEventManager';
import StaffManagement from './StaffManagement';
import TicketManagement from './TicketManagement';
import StaffTicketManagement from './StaffUX/StaffTicketManagement';
import PlanningManagement from './PlanningManagement';
import FinanceManagement from './FinanceManagement';
import PublicationDashboard from './PublicationDashboard';
import PublicationBuilder from './PublicationBuilder';
import OrderManagement from './OrderManagement';
import DashboardSidebar from '../components/DashboardSidebar';

type PageType = 'event-manager' | 'staff-management' | 'ticket-management' | 'order-management' | 'planning-management' | 'finance-management' | 'publication' | 'publication-builder' | 'support';

const PATH_TO_PAGE: Record<string, PageType> = {
  '/events': 'event-manager',
  '/staff': 'staff-management',
  '/tickets': 'ticket-management',
  '/commandes': 'order-management',
  '/planning': 'planning-management',
  '/finance': 'finance-management',
  '/publication': 'publication',
};

export interface Event {
  id: string;
  name: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout, user } = useAuth();
  const isAdmin = user?.role?.toString().toLowerCase() === 'admin';
  const [currentPage, setCurrentPage] = useState<PageType>('event-manager');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // builderEventId removed: use the globally selectedEventId when opening the publication builder
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null); // State pour l'ID de l'événement sélectionné
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!session?.access_token) return;
      const orgRes = await authAPI.getMyOrganization(session.access_token);
      if (orgRes.success && orgRes.organization) {
        const evRes = await authAPI.getEvents(orgRes.organization.id, session.access_token);
        if (evRes.success) {
          const evs = evRes.events || [];
          setEvents(evs);
          // Sélection par défaut du premier événement si rien n'est sélectionné
          if (evs.length > 0 && !selectedEventId) {
            setSelectedEventId(evs[0].id);
          }
        }
      }
    };
    load();
  }, [session]);

  useEffect(() => {
    const page = PATH_TO_PAGE[location.pathname];
    if (page) {
      if (!isAdmin && (page === 'publication' || page === 'order-management')) {
        navigate('/events', { replace: true });
        return;
      }
      setCurrentPage(page);
    }
  }, [location.pathname, isAdmin, navigate]);

  const handleLogoutClick = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur logout:', error);
    }
  };

  let pageContent: React.ReactNode;

  // Cast page components to `any` to avoid transient prop-type mismatches
  const EventManagerAny: any = EventManager;
  const StaffEventManagerAny: any = StaffEventManager;
  const StaffManagementAny: any = StaffManagement;
  const TicketManagementAny: any = TicketManagement;
  const StaffTicketManagementAny: any = StaffTicketManagement;
  const PlanningManagementAny: any = PlanningManagement;
  const FinanceManagementAny: any = FinanceManagement;
  const OrderManagementAny: any = OrderManagement;

  const currentEvent = events.find(e => e.id === selectedEventId);
  const topBarConfig = currentEvent ? { name: currentEvent.title || currentEvent.name, icon: 'event' } : undefined;

  if (currentPage === 'event-manager') {
    // If logged-in user is staff, show StaffEventManager instead of EventManager
    // Use AuthContext to detect role
    const userRole = (typeof window !== 'undefined' && localStorage.getItem('user')) ? (() => {
      try { return JSON.parse(localStorage.getItem('user') || '{}').role; } catch { return undefined; }
    })() : undefined;

    if (userRole === 'staff' || userRole === 'Staff') {
      pageContent = <StaffEventManagerAny onSelectEvent={setSelectedEventId} />;
    } else {
      pageContent = <EventManagerAny onSelectEvent={setSelectedEventId} />;
    }
  } else if (currentPage === 'staff-management') {
    pageContent = <StaffManagementAny selectedEventId={selectedEventId} />;
  } else if (currentPage === 'ticket-management') {
    const userRole = (typeof window !== 'undefined' && localStorage.getItem('user')) ? (() => {
      try { return JSON.parse(localStorage.getItem('user') || '{}').role; } catch { return undefined; }
    })() : undefined;

    if (userRole === 'staff' || userRole === 'Staff') {
      pageContent = <StaffTicketManagementAny selectedEventId={selectedEventId} />;
    } else {
      pageContent = <TicketManagementAny selectedEventId={selectedEventId} />;
    }
  } else if (currentPage === 'planning-management') {
    pageContent = <PlanningManagementAny selectedEventId={selectedEventId} />;
  } else if (currentPage === 'finance-management') {
    pageContent = <FinanceManagementAny selectedEventId={selectedEventId} />;
  } else if (currentPage === 'order-management' && isAdmin) {
    pageContent = <OrderManagementAny selectedEventId={selectedEventId} />;
  } else if (currentPage === 'publication' && isAdmin) {
    pageContent = <PublicationDashboard selectedEventId={selectedEventId} />;
  } else if (currentPage === 'publication-builder' && isAdmin) {
    pageContent = (
      <PublicationBuilder
        eventId={selectedEventId}
        eventName={currentEvent ? (currentEvent.title || currentEvent.name) : undefined}
        onBack={() => navigate('/publication')}
      />
    );
  }

  // Utiliser handleLogoutClick pour éviter l'avertissement
  console.log(handleLogoutClick);

  return ( 
    <div className="min-h-screen bg-background flex" style={{ '--sidebar-width': isSidebarCollapsed ? '72px' : '240px' } as React.CSSProperties}>
      <DashboardSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        toggleMobileSidebar={() => setIsMobileSidebarOpen((v) => !v)}
      />
      <div className="flex-1 md:ml-[var(--sidebar-width)] min-h-screen flex flex-col transition-all duration-300 min-w-0">
        <DashboardTopBar 
          selectedEvent={topBarConfig} 
          onSelectEvent={setSelectedEventId}
          toggleMobileSidebar={() => setIsMobileSidebarOpen((v) => !v)}
        />
        {pageContent}
      </div>
    </div>
  );
}
