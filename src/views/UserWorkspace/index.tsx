import React, { useState, useEffect, useRef } from 'react';
import UserSidebar from './UserSidebar';
import ChatArea from '../../components/ChatArea';
import MarketMainDashboard from '../../components/SidebarTabs/MarketMainDashboard';
import TicketsMainDashboard from '../../components/SidebarTabs/TicketsMainDashboard';
import SettingsDrawer from './SettingsDrawer';
import { Shield, Activity, Network } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

interface UserWorkspaceProps {
  user: any;
  isDark: boolean;
  setIsDark: (val: boolean) => void;
  onLogout: () => void;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  activeChatPeer?: { userId: number; username: string } | null;
  onSelectPeer?: (peer: { userId: number; username: string }) => void;
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
  onMarkAsRead?: (messageId: string, roomId: string) => void;
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
              <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center font-mono text-[10px] ${isDark ? 'bg-velum-900 text-text-secondary' : 'bg-text-primary text-text-disabled'}`}>
                <Activity className="w-8 h-8 text-accent opacity-40 mb-3 animate-pulse" />
                <p className={`font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-text-primary' : 'text-text-primary'}`}>No Channel Selected</p>
                <button 
                  onClick={() => setActivePanel('directory')}
                  className="mt-4 px-4 py-2 bg-velum-800 border border-velum-600 rounded-lg text-accent font-bold"
                >
                  Return to Directory
                </button>
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
              <div className={`flex-1 flex flex-col items-center justify-center p-12 text-center font-mono text-[9px] ${isDark ? 'text-text-secondary bg-velum-900' : 'text-text-disabled bg-text-primary'} tracking-widest`}>
                <div className="w-14 h-14 bg-velum-800/50 border border-velum-600 rounded-2xl flex items-center justify-center text-accent mb-4">
                  <Network className="w-6 h-6 animate-pulse" />
                </div>
                <p className={`font-bold uppercase mb-1 ${isDark ? 'text-white' : 'text-text-primary'}`}>Velum Chat Workspace</p>
                <p className="text-[8px] text-text-secondary max-w-xs leading-relaxed lowercase mt-1">
                  Select a chat channel or user conversation from the left sidebar to start messaging.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
