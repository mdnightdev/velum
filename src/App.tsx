import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPortal from './components/AuthPortal';
import DashboardLayout from './components/DashboardLayout';
import { useWebSocket } from './hooks/useWebSocket';
import ProfileMigration from './components/ProfileMigration';

const AdminControlDesk = lazy(() => import('./views/AdminControlDesk'));
const CliConsole = lazy(() => import('./components/CliConsole'));

function AppContent() {
  const { isAuthenticated, user, sessionId, deviceId, handleLoginSuccess, handleLogout, isLoadingSession } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [activeChatPeer, setActiveChatPeer] = useState<{ userId: number; username: string } | null>(null);
  const [migrationUser, setMigrationUser] = useState<{ userId: number; username: string } | null>(null);

  // Set up visual viewport height tracking to handle mobile keyboard resizing properly
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
    } else {
      window.addEventListener('resize', updateHeight);
    }
    
    updateHeight();

    // Run updateHeight after small timeouts to ensure correct initial dimensions and stable height
    const timer1 = setTimeout(updateHeight, 150);
    const timer2 = setTimeout(updateHeight, 450);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
        window.visualViewport.removeEventListener('scroll', updateHeight);
      } else {
        window.removeEventListener('resize', updateHeight);
      }
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

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

  // Admin Interface Mode (only for CLI_ADMIN)
  const [adminInterfaceMode, setAdminInterfaceMode] = useState<'CLI' | 'GUI'>('CLI');

  if (isLoadingSession) {
    return (
      <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900 items-center justify-center font-mono text-[10px] text-text-secondary/60 uppercase tracking-widest gap-2 select-none">
        <span>// Verifying Security Parameters //</span>
      </div>
    );
  }

  if (migrationUser) {
    return (
      <div className={`w-full h-dvh overflow-hidden flex flex-col ${isDark ? 'bg-velum-900' : 'bg-text-primary'}`}>
        <ProfileMigration 
          migrationUserId={migrationUser.userId} 
          migrationUsername={migrationUser.username} 
          onComplete={() => {
            setMigrationUser(null);
          }} 
          onCancel={() => {
            setMigrationUser(null);
          }} 
        />
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
          onMigrationRequired={(userId, username) => {
            setMigrationUser({ userId, username });
          }}
          tabPrefix="velum"
        />
      </div>
    );
  }

  // CLI Executive interface
  if (user.role === 'CLI_ADMIN') {
    if (adminInterfaceMode === 'CLI') {
     return (
       <div className="w-full h-dvh overflow-hidden flex flex-col bg-velum-900">
         <Suspense fallback={null}>
           <CliConsole 
             adminId={Number(user.userId)} 
             onLogout={handleLogout}
             onSwitchToGui={() => setAdminInterfaceMode('GUI')}
           />
         </Suspense>
       </div>
     );
    } else {
     return (
       <Suspense fallback={null}>
         <AdminControlDesk
           user={user}
           isDark={isDark}
           setIsDark={setIsDark}
           onLogout={handleLogout}
           onSwitchToCli={() => setAdminInterfaceMode('CLI')}
         />
       </Suspense>
     );
    }

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
