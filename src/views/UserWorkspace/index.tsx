import React, { useState, useEffect, useRef } from 'react';
import UserSidebar from './UserSidebar';
import ChatArea from '../../components/ChatArea';
import MarketMainDashboard from '../../components/SidebarTabs/MarketMainDashboard';
import TicketsMainDashboard from '../../components/SidebarTabs/TicketsMainDashboard';
import SettingsDrawer from './SettingsDrawer';
import { Shield, Activity, Network, Lock } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import logoSvg from '../../assets/logo.svg?raw';

interface UserWorkspaceProps {
  user: any;
  isDark: boolean;
  setIsDark: (val: boolean) => void;
  onLogout: () => void;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  activeChatPeer?: { userId: number; username: string; avatar?: string } | null;
  onSelectPeer?: (peer: { userId: number; username: string; avatar?: string }) => void;
  onClearChatPeer?: () => void;
  onProfileUpdate?: (updatedUser: any) => void;
  wsConnected: boolean;
  messages: any[];
  onSendMessage: (text: string, burnSeconds: number | null, isEncrypted: boolean) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick?: (targetId: number) => void;
  onRoomMute?: (targetId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onMarkAsRead?: (messageId: string, roomId: string, dbMessageId?: number) => void;
}

type ActivePanel = 'navigation' | 'directory' | 'workspace';

export default function UserWorkspace({
  user,
  isDark,
  setIsDark,
  onLogout,
  activeRoomId,
  onRoomSelect,
  activeChatPeer,
  onSelectPeer,
  onClearChatPeer,
  onProfileUpdate,
  wsConnected,
  messages,
  onSendMessage,
  onSendTyping,
  onRoomKick,
  onRoomMute,
  onSendReaction,
  onDeleteMessage,
  onMarkAsRead
}: UserWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>('directory');
  const [activeCategory, setActiveCategory] = useState<'rooms' | 'direct' | 'market' | 'tickets' | 'saved' | 'people' | 'notifications' | 'settings'>('rooms');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { isMobile, isTablet } = useResponsive();
  const useSlidingPanes = isMobile || isTablet;

  // Sync panel selection based on routing selection changes
  useEffect(() => {
    if (activeRoomId || activeChatPeer || (activeCategory !== 'rooms' && activeCategory !== 'direct')) {
      setActivePanel('workspace');
    } else {
      setActivePanel('directory');
    }
  }, [activeRoomId, activeChatPeer, activeCategory]);

  const handleBack = () => {
    if (activePanel === 'workspace') {
      if (onClearChatPeer) onClearChatPeer();
      onRoomSelect('');
      setActivePanel('directory');
    } else if (activePanel === 'directory') {
      setActivePanel('navigation');
    }
  };

  const getMobileTranslate = () => {
    if (activePanel === 'navigation') return 'translateX(0%)';
    if (activePanel === 'directory') return 'translateX(-100vw)';
    return 'translateX(-200vw)';
  };

  return (
    <div
      ref={containerRef}
      id="user-workspace-root"
      className={`relative w-full h-full overflow-hidden max-w-7xl mx-auto w-full select-none transition-colors duration-200 ${
        isDark ? 'bg-velum-900 text-text-primary' : 'bg-text-primary text-text-disabled'
      }`}
    >
      {/* Settings Drawer Slide out overlay */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUserId={user ? user.userId : 0}
        currentUsername={user ? user.username : 'Guest'}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onProfileUpdate={onProfileUpdate}
      />

      {/* 1. MOBILE VIEWPORT ENGINE */}
      {useSlidingPanes ? (
        <div 
          className="w-[300vw] h-full flex transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: getMobileTranslate() }}
        >
          {/* Panel A: Left Side controls */}
          <div className="w-[100vw] h-full flex-shrink-0">
            <UserSidebar
              currentUserId={user ? user.userId : 0}
              currentUsername={user ? user.username : 'Guest'}
              currentUserRole={user?.role || 'USER'}
              activeRoomId={activeRoomId}
              onRoomSelect={onRoomSelect}
              onLogout={onLogout}
              onSectionView={() => {}}
              activeView="chat"
              activeChatPeer={activeChatPeer || null}
              onSelectPeer={onSelectPeer}
              onClearChatPeer={onClearChatPeer}
              onProfileUpdate={onProfileUpdate}
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              wsConnected={wsConnected}
              messages={messages}
              onSendMessage={onSendMessage}
              onSendTyping={onSendTyping}
              onRoomKick={onRoomKick}
              onRoomMute={onRoomMute}
              onSendReaction={onSendReaction}
              onDeleteMessage={onDeleteMessage}
              isMobile={true}
              activePanel="navigation"
              onPanelChange={setActivePanel}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

          {/* Panel B: Directory Selector */}
          <div className="w-[100vw] h-full flex-shrink-0">
            <UserSidebar
              currentUserId={user ? user.userId : 0}
              currentUsername={user ? user.username : 'Guest'}
              currentUserRole={user?.role || 'USER'}
              activeRoomId={activeRoomId}
              onRoomSelect={onRoomSelect}
              onLogout={onLogout}
              onSectionView={() => {}}
              activeView="chat"
              activeChatPeer={activeChatPeer || null}
              onSelectPeer={onSelectPeer}
              onClearChatPeer={onClearChatPeer}
              onProfileUpdate={onProfileUpdate}
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              wsConnected={wsConnected}
              messages={messages}
              onSendMessage={onSendMessage}
              onSendTyping={onSendTyping}
              onRoomKick={onRoomKick}
              onRoomMute={onRoomMute}
              onSendReaction={onSendReaction}
              onDeleteMessage={onDeleteMessage}
              isMobile={true}
              activePanel="directory"
              onPanelChange={setActivePanel}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

          {/* Panel C: Workspace Active stream */}
          <div className="w-[100vw] h-full flex-shrink-0 flex flex-col">
            {activeRoomId || activeChatPeer ? (
              <ChatArea
                currentUserId={user ? user.userId : 0}
                currentUsername={user ? user.username : 'Guest'}
                currentUserRole={user?.role || 'USER'}
                roomId={activeRoomId}
                wsConnected={wsConnected}
                messages={messages}
                onSendMessage={onSendMessage}
                onSendTyping={onSendTyping}
                onRoomKick={onRoomKick || (() => {})}
                onRoomMute={onRoomMute || (() => {})}
                onSendReaction={onSendReaction}
                onDeleteMessage={onDeleteMessage}
                onMarkAsRead={onMarkAsRead}
                activeChatPeer={activeChatPeer}
                isDark={isDark}
                onBackToDeck={handleBack}
              />
            ) : (
              <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden ${isDark ? 'bg-velum-900 text-text-secondary' : 'bg-gray-100 text-gray-700'}`}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center max-w-sm space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-velum-800/80 border border-white-5 flex items-center justify-center text-accent shadow-2xl backdrop-blur-md animate-bounce-slow">
                    <div className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                  </div>
                  <div className="space-y-1.5">
                    <p className={`font-bold uppercase tracking-wider text-xs ${isDark ? 'text-text-primary' : 'text-gray-900'}`}>No Channel Selected</p>
                    <p className="text-[10px] leading-relaxed max-w-[240px] mx-auto text-text-secondary">
                      Select a conversation from the directory to start chatting securely.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActivePanel('directory')}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-velum-950 font-bold text-[10px] uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer"
                  >
                    Open Directory
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 2. TABLET & DESKTOP TWO-COLUMN LAYOUT */
        <div id="desktop-viewport-grid" className="w-full h-full flex overflow-hidden">
          
          {/* Column 1: Unified Navigation Sidebar (Left Column, expanded width 300px) */}
          <div className="w-[300px] h-full flex-shrink-0 border-r border-white-5 bg-velum-900 z-10 select-none">
            <UserSidebar
              currentUserId={user ? user.userId : 0}
              currentUsername={user ? user.username : 'Guest'}
              currentUserRole={user?.role || 'USER'}
              activeRoomId={activeRoomId}
              onRoomSelect={onRoomSelect}
              onLogout={onLogout}
              onSectionView={() => {}}
              activeView="chat"
              activeChatPeer={activeChatPeer || null}
              onSelectPeer={onSelectPeer}
              onClearChatPeer={onClearChatPeer}
              onProfileUpdate={onProfileUpdate}
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              wsConnected={wsConnected}
              messages={messages}
              onSendMessage={onSendMessage}
              onSendTyping={onSendTyping}
              onRoomKick={onRoomKick}
              onRoomMute={onRoomMute}
              onSendReaction={onSendReaction}
              onDeleteMessage={onDeleteMessage}
              isMobile={false}
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

          {/* Column 2: Full-Fidelity Active Chat Stream Canvas / Workspace Desk (Right Column, flex-1) */}
          <div className={`flex-1 h-full flex flex-col overflow-hidden`}>
            {activeRoomId || activeChatPeer ? (
              <ChatArea
                currentUserId={user ? user.userId : 0}
                currentUsername={user ? user.username : 'Guest'}
                currentUserRole={user?.role || 'USER'}
                roomId={activeRoomId}
                wsConnected={wsConnected}
                messages={messages}
                onSendMessage={onSendMessage}
                onSendTyping={onSendTyping}
                onRoomKick={onRoomKick || (() => {})}
                onRoomMute={onRoomMute || (() => {})}
                onSendReaction={onSendReaction}
                onDeleteMessage={onDeleteMessage}
                onMarkAsRead={onMarkAsRead}
                activeChatPeer={activeChatPeer}
                isDark={isDark}
                onBackToDeck={() => {
                  if (onClearChatPeer) onClearChatPeer();
                  onRoomSelect('');
                }}
              />
            ) : (
              <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden ${isDark ? 'bg-velum-900 text-text-secondary' : 'bg-gray-50 text-gray-700'}`}>
                {/* Decorative background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="relative z-10 flex flex-col items-center max-w-sm space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-velum-800/80 border border-white-5 flex items-center justify-center text-accent shadow-2xl backdrop-blur-md animate-bounce-slow">
                    <div className="w-10 h-10 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold tracking-[0.15em] text-text-primary uppercase font-display">
                      Velum Workspace
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed font-sans">
                      Select an active conversation or lounge from the directory to start messaging securely.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/5 border border-accent/10 text-[10px] font-mono text-accent uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" />
                    <span>End-to-End Encrypted</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
