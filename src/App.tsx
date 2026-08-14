import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { useWebSocket } from './hooks/useWebSocket';
import LoadingFallback from './components/LoadingFallback';
const AuthPortal = lazy(() => import('./components/AuthPortal'));
const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const ProfileMigration = lazy(() => import('./components/ProfileMigration'));
const AdminControlDesk = lazy(() => import('./views/AdminControlDesk'));


function AppContent() {
  const { isAuthenticated, user, sessionId, deviceId, handleLoginSuccess, handleLogout, isLoadingSession } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [activeChatPeer, setActiveChatPeer] = useState<{ userId: number; username: string; avatar?: string } | null>(null);
  const [migrationUser, setMigrationUser] = useState<{ userId: number; username: string } | null>(null);

  // Lock mobile viewport and ensure page never scrolls or offsets on virtual keyboard
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preventScrollOffset = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', preventScrollOffset);
      window.visualViewport.addEventListener('scroll', preventScrollOffset);
    } else {
      window.addEventListener('resize', preventScrollOffset);
    }
    
    preventScrollOffset();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', preventScrollOffset);
        window.visualViewport.removeEventListener('scroll', preventScrollOffset);
      } else {
        window.removeEventListener('resize', preventScrollOffset);
      }
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
    },
    onSessionCompromised: handleLogout
  });



  if (isLoadingSession) {
    return <LoadingFallback />;
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
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminControlDesk
          user={user}
          isDark={isDark}
          setIsDark={setIsDark}
          onLogout={handleLogout}
          wsConnected={ws.wsConnected}
          messages={ws.messages}
          onSendMessage={ws.sendMessage}
          onSendTyping={ws.sendTyping}
          onRoomKick={ws.kickMember}
          onRoomMute={ws.muteMember}
          activeRoomId={activeRoomId}
          setActiveRoomId={setActiveRoomId}
        />
      </Suspense>
    );
  }
  

  // System Administration desks
  if (user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN' || user.role === 'ADMIN') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminControlDesk 
          user={user} 
          isDark={isDark} 
          setIsDark={setIsDark} 
          onLogout={handleLogout} 
          wsConnected={ws.wsConnected}
          messages={ws.messages}
          onSendMessage={ws.sendMessage}
          onSendTyping={ws.sendTyping}
          onRoomKick={ws.kickMember}
          onRoomMute={ws.muteMember}
          activeRoomId={activeRoomId}
          setActiveRoomId={setActiveRoomId}
        />
      </Suspense>
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
      lastMessages={ws.lastMessages}
      unreadCounts={ws.unreadCounts}
      onSendMessage={ws.sendMessage}
      onSendTyping={ws.sendTyping}
      onRoomKick={ws.kickMember}
      onRoomMute={ws.muteMember}
      onSendReaction={ws.sendReaction}
      onEditMessage={ws.editMessage}
      onDeleteMessage={ws.deleteMessage}
      onPinMessage={ws.pinMessage}
      onMarkAsRead={ws.markAsRead}
      onMarkAllAsRead={ws.markAllAsRead}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <Suspense fallback={<LoadingFallback />}>
            <AppContent />
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
