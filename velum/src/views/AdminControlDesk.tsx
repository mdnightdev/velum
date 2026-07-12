import React, { useState } from 'react';
import AdminPanel from '../components/AdminPanel';

interface AdminControlDeskProps {
  user: any;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  onLogout: () => void;
}

export default function AdminControlDesk({
  user,
  isDark,
  setIsDark,
  onLogout
}: AdminControlDeskProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tickets' | 'reports' | 'announcements' | 'moderation' | 'system' | 'logs' | 'settings'>('overview');

  return (
    <div id="admin_control_desk_view" className="w-full h-dvh bg-velum-900 flex flex-col overflow-hidden font-sans select-none">
      <AdminPanel
        adminId={Number(user.userId)}
        adminRole="LOGIN_ADMIN"
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
        isDark={isDark}
        onLogout={onLogout}
        user={user}
      />
    </div>
  );
}
