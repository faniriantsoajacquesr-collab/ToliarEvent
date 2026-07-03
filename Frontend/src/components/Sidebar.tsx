import { useState } from 'react';
import DashboardSidebar from './DashboardSidebar';

interface Props {
  isMobileSidebarOpen?: boolean;
  toggleMobileSidebar?: () => void;
}

export default function Sidebar({ isMobileSidebarOpen = false, toggleMobileSidebar }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggle = () => setIsCollapsed((c) => !c);

  return (
    <DashboardSidebar
      isCollapsed={isCollapsed}
      onToggle={handleToggle}
      isMobileSidebarOpen={isMobileSidebarOpen}
      toggleMobileSidebar={toggleMobileSidebar}
    />
  );
}
