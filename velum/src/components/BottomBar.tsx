import React from 'react';
import { Users, Globe, MessageSquare, User, ShoppingCart } from 'lucide-react';

interface BottomBarProps {
  activeCategory: string;
  activeRoomId: string;
  activeChatPeer: any;
  pendingRequestsCount?: number;
  onSelectCategory: (cat: 'rooms' | 'direct' | 'market' | 'tickets' | 'saved' | 'people' | 'notifications') => void;
  onRoomSelect: (roomId: string) => void;
  onClearChatPeer: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onTabClick?: (tabId: 'people' | 'lounge' | 'chats' | 'profile' | 'market') => void;
}

export default function BottomBar({
  activeCategory,
  activeRoomId,
  activeChatPeer,
  pendingRequestsCount = 0,
  onSelectCategory,
  onRoomSelect,
  onClearChatPeer,
  onOpenSettings,
  onToggleSidebar,
  onTabClick,
}: BottomBarProps) {
  
  // Determine which tab is currently selected
  const getActiveTab = () => {
    if (activeCategory === 'people') return 'people';
    if (activeCategory === 'direct') return 'chats';
    if (activeCategory === 'rooms') return 'lounge';
    if (activeCategory === 'market') return 'market';
    return '';
  };

  const activeTab = getActiveTab();

  const handleTabClick = (tabId: 'people' | 'lounge' | 'chats' | 'profile' | 'market') => {
    if (onTabClick) {
      onTabClick(tabId);
      return;
    }
    if (tabId === 'people') {
      onSelectCategory('people');
    } else if (tabId === 'lounge') {
      onSelectCategory('rooms');
    } else if (tabId === 'chats') {
      onSelectCategory('direct');
    } else if (tabId === 'market') {
      onSelectCategory('market');
    } else if (tabId === 'profile') {
      onOpenSettings();
    }
  };

  const tabs = [
    { id: 'people', label: 'Friends', icon: <Users className="w-5 h-5" />, badge: pendingRequestsCount },
    { id: 'lounge', label: 'Lounge', icon: <Globe className="w-5 h-5" /> },
    { id: 'chats', label: 'Chats', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'market', label: 'Market', icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-sm h-16 bg-velum-800/95 backdrop-blur-md border-t border-white-5 flex items-center justify-evenly px-2 z-50 select-none pb-safe transition-transform duration-300 bottom-nav">
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        const badge = 'badge' in tab ? tab.badge : undefined;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id as any)}
            className="flex flex-col items-center justify-center flex-1 h-full min-h-[48px] relative text-text-secondary active:scale-95 transition-all cursor-pointer"
          >
            {/* Visual highlight bar on top of selected tab */}
            {isSelected && (
              <span className="absolute top-0 w-8 h-[2px] bg-accent rounded-full" />
            )}

            {/* Icon Wrapper */}
            <div className={`relative p-1 rounded-xl transition-colors ${isSelected ? 'text-accent' : 'text-text-secondary'}`}>
              {tab.icon}

              {/* Badge for notification updates (e.g., pending friends count) */}
              {badge && badge > 0 ? (
                <span className="absolute -top-1 -right-1 bg-accent text-velum-900 text-[8px] font-bold px-1 py-0.5 rounded-full min-w-[14px] text-center shadow-md">
                  {badge}
                </span>
              ) : null}
            </div>

            {/* Label */}
            <span className={`text-[9px] font-bold tracking-wider mt-0.5 uppercase font-sans ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
