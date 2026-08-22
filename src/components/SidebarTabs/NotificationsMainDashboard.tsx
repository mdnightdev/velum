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
  const [selectedCategory, setSelectedCategory] = useState<'transactions' | 'market' | null>(null);
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
      const headers = { 'Authorization': `******`, 'Content-Type': 'application/json' };
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

  // simple placeholder when nothing selected
  return (
    <div id="notifications_dashboard" className="flex-1 bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 select-none">
      {onToggleSidebar && (
        <div className="md:hidden pb-2 border-b border-white-5 flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl border border-white-5 text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
            aria-label="Open sidebar menu"
            title="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Notifications</span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Main list area */}
        <div className="glass-card lg:col-span-8 p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>{selectedCategory === 'transactions' ? 'Transactions' : selectedCategory === 'market' ? 'Market Notifications' : 'Notifications'}</span>
          </h3>

          {selectedCategory ? (
            loading ? (
              <div className="text-sm">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-sm">No notifications in this category.</div>
            ) : (
              <div className="space-y-2">
                {items.map((n: any, idx: number) => {
                  const txId = n.transaction_id || n.txid || n.tx_id || n.id;
                  const rawAmount = n.amount ?? n.value ?? n.amount_cents ?? null;
                  // Try to format cents -> decimal when obvious
                  const amount = (typeof rawAmount === 'number' && Math.abs(rawAmount) > 1000 && String(rawAmount).length > 3 && rawAmount % 100 === 0)
                    ? (rawAmount / 100).toFixed(2)
                    : rawAmount;
                  const currency = n.currency || n.currency_code || '';

                  return (
                    <div key={txId || idx} className="bg-velum-900 border border-white-5 p-3 rounded">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {selectedCategory === 'transactions'
                              ? (n.title || (txId ? `Transaction ${txId}` : 'Transaction'))
                              : (n.title || n.message || 'Notification')}
                          </div>

                          {selectedCategory === 'transactions' ? (
                            <div className="text-[11px] text-text-secondary mt-1">
                              <span className="font-medium">Amount:</span>{' '}
                              {amount != null ? `${amount}${currency ? ' ' + currency : ''}` : '—'}
                              {txId && (
                                <span className="ml-3">• ID: <span className="font-mono">{txId}</span></span>
                              )}
                              {n.body && <div className="mt-1 text-[11px] text-text-secondary">{n.body}</div>}
                            </div>
                          ) : (
                            n.body && <div className="text-[11px] text-text-secondary mt-1">{n.body}</div>
                          )}
                        </div>

                        <div className="text-[10px] text-text-secondary">
                          {n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center p-6 rounded bg-velum-900/20">
              <div className="text-sm font-bold">Select Transactions or Market from the right</div>
            </div>
          )}
        </div>

        {/* Sidebar: categories */}
        <div className="glass-card lg:col-span-4 p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary font-mono flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            <span>Categories</span>
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={() => setSelectedCategory('transactions')} className={`w-full text-left bg-velum-900/40 border border-white-5 rounded p-3 flex items-center justify-between ${selectedCategory === 'transactions' ? 'ring-2 ring-accent' : ''}`}>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-semibold">Transactions</span>
                </div>
                <span className="text-[11px] bg-accent text-velum-900 px-2 py-0.5 rounded-full">{notificationCounts.transactions}</span>
              </button>

              <button type="button" onClick={() => setSelectedCategory('market')} className={`w-full text-left bg-velum-900/40 border border-white-5 rounded p-3 flex items-center justify-between ${selectedCategory === 'market' ? 'ring-2 ring-accent' : ''}`}>
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-semibold">Market</span>
                </div>
                <span className="text-[11px] bg-accent text-velum-900 px-2 py-0.5 rounded-full">{notificationCounts.market}</span>
              </button>
            </div>

            <div className="mt-2">
              <p className="text-[10px] text-text-secondary">Tap a category to view its notifications. Transaction items show amount and ID.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
