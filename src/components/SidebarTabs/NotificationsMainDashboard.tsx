import React, { useState } from 'react';
import { Mail, ShieldCheck, HelpCircle, Inbox, Bell, ShoppingCart } from 'lucide-react';
import { FriendRequest } from '../../types';

interface NotificationsMainDashboardProps {
  friendRequests: FriendRequest[];
  currentUserId: number;
  isDark?: boolean;
  handleRespondFriendRequest: (requestId: string, action: 'accepted' | 'declined') => void;
  notificationCounts?: { transactions: number; market: number; system: number };
}

export default function NotificationsMainDashboard({
  friendRequests,
  currentUserId,
  isDark = true,
  handleRespondFriendRequest,
  notificationCounts = { transactions: 0, market: 0, system: 0 }
}: NotificationsMainDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<'transactions' | 'market' | 'system' | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';

  const loadCategoryItems = async (category: string) => {
    try {
      setLoading(true);
      const sId = fetchSessionId();
      if (!sId) {
        setItems([]);
        setLoading(false);
        return;
      }
      const headers = { 'Authorization': `******`, 'Content-Type': 'application/json' };
      const res = await fetch(`/v2/notifications?category=${category}`, { headers });
      if (!res.ok) {
        setItems([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      // Expect array of notifications
      setItems(Array.isArray(data) ? data : (data.notifications || []));
    } catch (err) {
      console.warn('Failed to load notifications for', category, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (selectedCategory) {
      loadCategoryItems(selectedCategory);
    } else {
      setItems([]);
    }
  }, [selectedCategory]);

  const safeRequests = Array.isArray(friendRequests) ? friendRequests : [];

  return (
    <div id="notifications_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-6 select-none">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Notifications */}
        <div className="glass-card lg:col-span-6 p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            <span>Recent Notifications</span>
          </h3>

          <div className="text-center p-6 rounded bg-velum-900/20">
            <div className="text-sm font-bold">No notifications</div>
          </div>
        </div>

        {/* Notifications Overview */}
        <div className="glass-card lg:col-span-6 p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary font-mono flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={() => setSelectedCategory('transactions')} className="w-full text-left bg-velum-900/40 border border-white-5 rounded p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-semibold">Transactions</span>
                </div>
                <span className="text-[11px] bg-accent text-velum-900 px-2 py-0.5 rounded-full">{notificationCounts.transactions}</span>
              </button>

              <button type="button" onClick={() => setSelectedCategory('market')} className="w-full text-left bg-velum-900/40 border border-white-5 rounded p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-semibold">Market</span>
                </div>
                <span className="text-[11px] bg-accent text-velum-900 px-2 py-0.5 rounded-full">{notificationCounts.market}</span>
              </button>

              <button type="button" onClick={() => setSelectedCategory('system')} className="w-full text-left bg-velum-900/40 border border-white-5 rounded p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">System</span>
                </div>
                <span className="text-[11px] bg-accent text-velum-900 px-2 py-0.5 rounded-full">{notificationCounts.system}</span>
              </button>
            </div>

            <p className="text-[10px] text-text-secondary">Filter notifications by category. Financial notifications include transaction IDs, amounts and timestamps. Tap a notification to view details.</p>

            {selectedCategory && (
              <div className="mt-3 bg-velum-900/30 border border-white-5 rounded p-3 text-[10.5px] text-text-secondary">
                {selectedCategory === 'transactions' && <div>No transaction notifications yet.</div>}
                {selectedCategory === 'market' && <div>No market notifications yet.</div>}
                {selectedCategory === 'system' && <div>No system notifications yet.</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
