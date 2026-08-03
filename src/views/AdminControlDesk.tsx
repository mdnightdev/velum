import React, { useState } from 'react';
import AdminPanel from '../components/AdminPanel';

interface AdminControlDeskProps {
  user: any;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  onLogout: () => void;
  wsConnected?: boolean;
  messages?: any[];
  onSendMessage?: any;
  onSendTyping?: any;
  onRoomKick?: any;
  onRoomMute?: any;
  activeRoomId?: string;
  setActiveRoomId?: any;
}

export default function AdminControlDesk({
  user,
  isDark,
  setIsDark,
  onLogout,
  wsConnected,
  messages,
  onSendMessage,
  onSendTyping,
  onRoomKick,
  onRoomMute,
  activeRoomId,
  setActiveRoomId
}: AdminControlDeskProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'tickets' | 'reports' | 'moderation' | 'system' | 'logs' | 'bank' | 'profile'>('overview');

  return (
    <div id="admin_control_desk_view" className="w-full h-dvh bg-velum-900 flex flex-col overflow-hidden font-sans select-none">
      <AdminPanel
        adminId={Number(user.userId)}
        adminRole={user.role}
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
        isDark={isDark}
        onLogout={onLogout}
        user={user} wsConnected={wsConnected} messages={messages} onSendMessage={onSendMessage} onSendTyping={onSendTyping} onRoomKick={onRoomKick} onRoomMute={onRoomMute} activeRoomId={activeRoomId} setActiveRoomId={setActiveRoomId}
      />
    </div>
  );
}
