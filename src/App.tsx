import { ErrorBoundary } from './components/ErrorBoundary';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { useWebSocket } from './hooks/useWebSocket';
import LoadingFallback from './components/LoadingFallback';
import { initAppearance } from './utils/appearance';
import { LocalNotifications } from '@capacitor/local-notifications';
import { registerPushNotifications } from './utils/pushNotifications';


import { Toaster } from 'react-hot-toast';
import MaintenanceBanner from './components/MaintenanceBanner';

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

  // Initialize global appearance settings
  useEffect(() => {
    initAppearance();
  }, []);


  // Request notification permissions and register system channels immediately on mount
  useEffect(() => {
    LocalNotifications.requestPermissions().then(() => {
      LocalNotifications.createChannel({
        id: 'velum_messages',
        name: 'Messages',
        description: 'Direct messages and lounge notifications',
        importance: 5,
        visibility: 1,
        vibration: true,
      }).catch(() => {});

      LocalNotifications.createChannel({
        id: 'velum_default',
        name: 'General Alerts',
        description: 'General system notifications',
        importance: 5,
        visibility: 1,
        vibration: true,
      }).catch(() => {});

      LocalNotifications.removeAllListeners().catch(() => {});
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const data = action.notification?.extra || {};
        const targetRoom = data.roomId || data.room_id || data.tag;
        if (targetRoom && targetRoom !== 'velum-chat') {
          window.dispatchEvent(new CustomEvent('velum-open-room', { detail: { roomId: targetRoom } }));
        }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Register push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerPushNotifications();
    }
  }, [isAuthenticated]);

 

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

  // Push notification click navigation
  useEffect(() => {
    const handleOpenRoom = (e: any) => {
      const targetRoom = e.detail?.roomId;
      if (targetRoom) {
        setActiveRoomId(targetRoom);
      }
    };
    window.addEventListener('velum-open-room', handleOpenRoom);
    return () => window.removeEventListener('velum-open-room', handleOpenRoom);
  }, []);

  // Native deep link & shortcut URL router
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', (event) => {
        const url = event.url;
        if (!url) return;
        try {
          const parsed = new URL(url);
          const host = parsed.host;
          const pathname = parsed.pathname.replace(/^\//, '');

          if (host === 'category') {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: pathname } }));
          } else if (host === 'dm' || host === 'room') {
            const roomId = host === 'dm' ? `dm_${pathname}` : pathname;
            setActiveRoomId(roomId);
          } else if (host === 'chats' || host === 'direct') {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: 'direct' } }));
          } else if (host === 'wallet') {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: 'wallet' } }));
          } else if (host === 'lounges' || host === 'rooms') {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: 'rooms' } }));
          }
        } catch {
          if (url.includes('wallet')) {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: 'wallet' } }));
          } else if (url.includes('direct') || url.includes('chats')) {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: 'direct' } }));
          } else if (url.includes('rooms') || url.includes('lounges')) {
            window.dispatchEvent(new CustomEvent('velum-open-category', { detail: { category: 'rooms' } }));
          }
        }
      }).then(handle => {
        removeListener = () => handle.remove();
      });
    }).catch(() => {});

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

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
      onSelectPeer={(peer) => {
        setActiveChatPeer(peer);
        if (peer && user) {
          const dmRoomId = peer.userId === 999 
            ? `dm_velum_${user.userId}`
            : `dm_${Math.min(user.userId, peer.userId)}_${Math.max(user.userId, peer.userId)}`;
          setActiveRoomId(dmRoomId);
        } else {
          setActiveRoomId('');
        }
      }}
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
      onRetryMessage={ws.retryMessage}
      onMarkAsRead={ws.markAsRead}
      onMarkAllAsRead={ws.markAllAsRead}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AuthProvider>
          <CartProvider>
            <Toaster position="top-center" />
            <MaintenanceBanner />
            <Suspense fallback={<LoadingFallback />}>
              <AppContent />
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </ErrorBoundary>
    </LanguageProvider>
  );
}
