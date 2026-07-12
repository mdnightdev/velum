import React, { useState } from 'react';
import AdminPanel from '../components/AdminPanel';

interface AdminControlDeskProps {
  user: any;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  onLogout: () => void;
  onSwitchToCli?: () => void;
}

export default function AdminControlDesk({
  user,
  isDark,
  setIsDark,
  onLogout,
  onSwitchToCli
}: AdminControlDeskProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tickets' | 'reports' | 'announcements' | 'moderation' | 'system' | 'logs' | 'bank' | 'profile'>('overview');

  return (
    <div id="admin_control_desk_view" className="w-full h-dvh bg-velum-900 flex flex-col overflow-hidden font-sans select-none">
      <AdminPanel
        adminId={Number(user.userId)}
        adminRole={user.role}
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
        isDark={isDark}
        onLogout={onLogout}
        user={user}
        onSwitchToCli={onSwitchToCli}
      />
    </div>
  );
}
