import React, { useState, useEffect } from 'react';
import { Mail, HelpCircle, Inbox, Bell, ShoppingCart, Menu } from 'lucide-react';
import { FriendRequest } from '../../types';
import { getSessionId } from '../../utils/auth';

interface NotificationsMainDashboardProps {
  friendRequests: FriendRequest[];
  currentUserId: number;
  isDark?: boolean;
  handleRespondFriendRequest: (requestId: string, action: 'accepted' | 'declined') => void;
  notificationCounts?: { transactions: number; market: number; system?: number };
  onToggleSidebar?: () => void;
}

export default function NotificationsMainDashboard({
  friendRequests,
  currentUserId,
  isDark = true,
  handleRespondFriendRequest,
  notificationCounts = { transactions: 0, market: 0 },
  onToggleSidebar
}: NotificationsMainDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<'transactions' | 'market'>('transactions');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchSessionId = () => getSessionId();

  const loadCategoryItems = async (category: string) => {
    try {
      setLoading(true);
      const sId = fetchSessionId();
      if (!sId) {
        setItems([]);
        setLoading(false);
        return;
      }
      const headers = { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' };
      const res = await fetch(`/v2/notifications?category=${encodeURIComponent(category)}`, { headers });
      if (!res.ok) {
        setItems([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : (data.notifications || []));
    } catch (err) {
      console.warn('Failed to load notifications for', category, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCategory) loadCategoryItems(selectedCategory);
    else setItems([]);
  }, [selectedCategory]);

  return (
    <div id="notifications_dashboard" className="flex-1 bg-transparent p-3 sm:p-4 space-y-4 max-w-4xl mx-auto w-full select-none text-text-primary">
      {/* Top Bar with Category Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-velum-600 pb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 rounded-lg border border-velum-600 text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              aria-label="Open sidebar menu"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 bg-velum-800 p-1 rounded-lg border border-velum-600">
            <button
              type="button"
              onClick={() => setSelectedCategory('transactions')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === 'transactions'
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Transactions</span>
              {notificationCounts.transactions > 0 && (
                <span className="text-[10px] bg-accent text-black font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                  {notificationCounts.transactions}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('market')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === 'market'
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Market</span>
              {notificationCounts.market > 0 && (
                <span className="text-[10px] bg-accent text-black font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                  {notificationCounts.market}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List Area */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-xs text-text-secondary py-8 text-center">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-velum-800 border border-velum-600 rounded-xl">
            <Bell className="w-8 h-8 mx-auto mb-2 text-text-secondary opacity-40" />
            <p className="text-xs text-text-secondary">No notifications in this category.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n: any, idx: number) => {
              const txId = n.transaction_id || n.txid || n.tx_id || n.id;
              const rawAmount = n.amount ?? n.value ?? n.amount_cents ?? null;
              const amount = (typeof rawAmount === 'number' && Math.abs(rawAmount) > 1000 && String(rawAmount).length > 3 && rawAmount % 100 === 0)
                ? (rawAmount / 100).toFixed(2)
                : rawAmount;
              const currency = n.currency || n.currency_code || '';

              return (
                <div key={txId || idx} className="bg-velum-800 border border-velum-600 p-3.5 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-xs text-text-primary">
                        {selectedCategory === 'transactions'
                          ? (n.title || (txId ? `Transaction #${txId}` : 'Transaction'))
                          : (n.title || n.message || 'Notification')}
                      </div>

                      {selectedCategory === 'transactions' ? (
                        <div className="text-xs text-text-secondary mt-1 space-y-0.5">
                          <div>
                            <span className="font-medium text-text-primary">Amount:</span>{' '}
                            {amount != null ? `${amount}${currency ? ' ' + currency : ''}` : '—'}
                            {txId && (
                              <span className="ml-2 font-mono text-[10px] text-text-disabled">ID: {txId}</span>
                            )}
                          </div>
                          {n.body && <div className="text-xs text-text-secondary">{n.body}</div>}
                        </div>
                      ) : (
                        n.body && <div className="text-xs text-text-secondary mt-1">{n.body}</div>
                      )}
                    </div>

                    <div className="text-[10px] text-text-secondary shrink-0">
                      {n.timestamp ? new Date(n.timestamp).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
