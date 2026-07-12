import React from 'react';
import { Mail, ShieldCheck, HelpCircle, Inbox, Bell } from 'lucide-react';
import { FriendRequest } from '../../types';

interface NotificationsMainDashboardProps {
  friendRequests: FriendRequest[];
  currentUserId: number;
  isDark?: boolean;
  handleRespondFriendRequest: (requestId: string, action: 'accepted' | 'declined') => void;
}

export default function NotificationsMainDashboard({
  friendRequests,
  currentUserId,
  isDark = true,
  handleRespondFriendRequest
}: NotificationsMainDashboardProps) {
  const pendingRequests = friendRequests.filter(
    (r) => r.status === 'pending' && Number(r.receiver_id) === currentUserId
  );

  return (
    <div id="notifications_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-6 select-none">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Verification Invites */}
        <div className="glass-card lg:col-span-6 p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            <span>Identity Link Invitations ({pendingRequests.length})</span>
          </h3>

          {pendingRequests.length === 0 ? (
            <div className="text-[10px] text-text-secondary font-mono leading-relaxed bg-velum-900/40 border border-white/[0.01] rounded p-4 text-center">
              No pending invites queueing currently on this address.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.request_id} className="bg-velum-900 border border-white-5 p-4 rounded flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="text-[8px] font-black tracking-widest text-text-secondary font-mono block">INVITATION</span>
                    <span className="text-xs font-mono font-bold text-text-primary">ID: #{req.sender_id}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      id={`notif_accept_${req.request_id}`}
                      onClick={() => handleRespondFriendRequest(req.request_id, 'accepted')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-status-online text-white rounded text-[9px] font-bold uppercase transition border-0 cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      id={`notif_decline_${req.request_id}`}
                      onClick={() => handleRespondFriendRequest(req.request_id, 'declined')}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold uppercase transition border-0 cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Logs */}
        <div className="glass-card lg:col-span-6 p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary font-mono flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>Active Node Logs</span>
          </h3>

          <div className="space-y-3">
            <div className="bg-velum-900 border border-white-5 p-3.5 rounded flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-status-online mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[8px] font-black tracking-widest text-status-online font-mono block">SECURITY PROTOCOL SEEDED</span>
                <p className="text-[10.5px] text-text-secondary leading-relaxed mt-1">
                  Local device fingerprint logged. Cryptoseed verified. Integrity check level 600 DPI.
                </p>
              </div>
            </div>

            <div className="bg-velum-900 border border-white-5 p-3.5 rounded flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-status-online mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[8px] font-black tracking-widest text-status-online font-mono block">SOCKET HANDSHAKE ACTIVE</span>
                <p className="text-[10.5px] text-text-secondary leading-relaxed mt-1">
                  Active connection established to secure WebSocket proxy port 3000. Ping status online.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
