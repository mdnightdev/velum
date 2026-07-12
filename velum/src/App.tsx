import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPortal from './components/AuthPortal';
import DashboardLayout from './components/DashboardLayout';
import AdminControlDesk from './views/AdminControlDesk';
import CliConsole from './components/CliConsole';
import { useWebSocket } from './hooks/useWebSocket';

function AppContent() {
  const { isAuthenticated, user, sessionId, deviceId, handleLoginSuccess, handleLogout, isLoadingSession } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [activeChatPeer, setActiveChatPeer] = useState<{ userId: number; username: string } | null>(null);

  // Active DM room configuration
  useEffect(() => {
    if (activeChatPeer && user) {
      const dmRoomId = activeChatPeer.userId === 999 
        ? `dm_velum_${user.userId}`
        : `dm_${Math.min(user.userId, activeChatPeer.userId)}_${Math.max(user.userId, activeChatPeer.userId)}`;
      setActiveRoomId(dmRoomId);
    }
  }, [activeChatPeer, user]);

  // WebSocket connection integration
  const ws = useWebSocket({
    userId: user ? Number(user.userId) : null,
    sessionId,
    isAuthenticated,
    activeRoomId,
    onMessageReceived: (msg) => {
      // Message received event callback if needed
    }
  });

  if (isLoadingSession) {
    return (
      <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900 items-center justify-center font-mono text-[10px] text-text-secondary/60 uppercase tracking-widest gap-2 select-none">
        <span>// Verifying Security Parameters //</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className={`w-full h-dvh overflow-hidden flex flex-col ${isDark ? 'bg-velum-900' : 'bg-text-primary'}`}>
        <AuthPortal 
          isDark={isDark} 
          setIsDark={setIsDark}
          onLoginSuccess={(loggedUser, sId, dId, activeView) => {
            handleLoginSuccess(loggedUser, sId, dId, activeView);
          }} 
          tabPrefix="velum"
        />
      </div>
    );
  }

  // CLI Executive interface
  if (user.role === 'CLI_ADMIN') {
    return (
      <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900">
        <CliConsole adminId={Number(user.userId)} onLogout={handleLogout} />
      </div>
    );
  }

  // System Administration desks
  if (user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN') {
    return (
      <AdminControlDesk 
        user={user} 
        isDark={isDark} 
        setIsDark={setIsDark} 
        onLogout={handleLogout} 
      />
    );
  }

  // Standard user chat environment
  return (
    <DashboardLayout
      user={user}
      isDark={isDark}
      setIsDark={setIsDark}
      onLogout={handleLogout}
      activeRoomId={activeRoomId}
      onRoomSelect={(roomId) => {
        // If selecting a room, clear the active chat peer if it is not a DM
        if (!roomId.startsWith('dm_')) {
          setActiveChatPeer(null);
        }
        setActiveRoomId(roomId);
      }}
      activeChatPeer={activeChatPeer}
      onSelectPeer={setActiveChatPeer}
      onClearChatPeer={() => {
        setActiveChatPeer(null);
        setActiveRoomId('');
      }}
      wsConnected={ws.wsConnected}
      messages={ws.messages}
      onSendMessage={ws.sendMessage}
      onSendTyping={ws.sendTyping}
      onRoomKick={ws.kickMember}
      onRoomMute={ws.muteMember}
      onSendReaction={ws.sendReaction}
      onDeleteMessage={ws.deleteMessage}
      onMarkAsRead={ws.markAsRead}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
