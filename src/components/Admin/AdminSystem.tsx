import React, { useState } from 'react';
import { UserPlus, Unlock, Sliders, Megaphone } from 'lucide-react';

interface AdminSystemProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
  approveQuarantineAccess: (targetUserId: string, action: 'approve' | 'deny') => Promise<void>;
}

export default function AdminSystem({
  adminId,
  adminRole,
  adminFetch,
  fetchData,
  approveQuarantineAccess,
}: AdminSystemProps) {
  // Local States
  const [invDays, setInvDays] = useState(7);
  const [newCodeInfo, setNewCodeInfo] = useState<string | null>(null);
  const [isGatewayLocked, setIsGatewayLocked] = useState(false);
  const [quarantineTargetId, setQuarantineTargetId] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'room' | 'user'>('all');
  const [broadcastRoomId, setBroadcastRoomId] = useState('');
  const [broadcastUserId, setBroadcastUserId] = useState('');

  const generateNewInvite = async () => {
    setNewCodeInfo(null);
    try {
      const res = await adminFetch(`/v2/admin/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          expiresInDays: invDays,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewCodeInfo(data.code);
        fetchData();
      } else {
        alert(data.error || 'Failed to create invite.');
      }
    } catch {
      alert('Connection error.');
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      alert('Broadcast message cannot be empty.');
      return;
    }
    try {
      const res = await adminFetch('/v2/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastMsg,
          target: broadcastTarget === 'user' ? parseInt(broadcastUserId, 10) : broadcastTarget,
          roomId: broadcastTarget === 'room' ? broadcastRoomId : undefined
        })
      });
      if (res.ok) {
        alert('Broadcast sent successfully.');
        setBroadcastMsg('');
        setBroadcastRoomId('');
        setBroadcastUserId('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send broadcast.');
      }
    } catch {
      alert('Connection error.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Entry code creation layout */}
        <div className="bg-velum-800 border border-velum-600 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-3">
              <UserPlus className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-xs text-text-primary">
                Generate Invite
              </h4>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Expiry (Days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={invDays}
                    onChange={(e) => setInvDays(parseInt(e.target.value, 10))}
                    className="p-2 rounded-lg w-20 outline-none text-center bg-velum-750 border border-velum-600 text-text-primary"
                  />
                  <span className="text-text-secondary text-xs">
                    days
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-away/10 text-status-away p-2.5 rounded-lg text-xs text-center font-medium">
                Admin permissions required.
              </div>
            ) : (
              <>
                <button
                  onClick={generateNewInvite}
                  className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg transition cursor-pointer text-xs"
                >
                  Generate Invite
                </button>
                {newCodeInfo && (
                  <div className="p-2 bg-accent/10 border border-accent/20 text-accent rounded-lg text-xs text-center">
                    Invite code:{' '}
                    <strong className="text-text-primary select-all ml-1">{newCodeInfo}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-velum-800 border border-velum-600 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-3">
              <Unlock className="w-4 h-4 text-status-away" />
              <h4 className="font-semibold text-xs text-text-primary">
                Maintenance Mode
              </h4>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              Temporarily closes new registrations and socket connections for system maintenance.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-dnd/10 text-status-dnd p-2.5 rounded-lg text-xs text-center font-medium">
                Admin permissions required.
              </div>
            ) : (
              <>
                {isGatewayLocked ? (
                  <button
                    onClick={() => {
                      setIsGatewayLocked(false);
                      alert('Maintenance mode disabled.');
                    }}
                    className="w-full bg-status-online hover:bg-status-online/80 text-text-primary font-semibold py-2 rounded-lg transition cursor-pointer text-xs"
                  >
                    Disable Maintenance Mode
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsGatewayLocked(true);
                      alert('Maintenance mode enabled.');
                    }}
                    className="w-full bg-status-dnd hover:bg-status-dnd/80 text-text-primary font-semibold py-2 rounded-lg transition cursor-pointer text-xs"
                  >
                    Enable Maintenance Mode
                  </button>
                )}
                <div className="text-xs text-text-secondary">
                  Status:{' '}
                  {isGatewayLocked ? (
                    <span className="text-status-dnd font-semibold">Active</span>
                  ) : (
                    <span className="text-status-online font-semibold">Normal</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Account Restore */}
        <div className="bg-velum-800 border border-velum-600 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-3">
              <Sliders className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-xs text-text-primary">
                Restore Account
              </h4>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  placeholder="Enter user ID"
                  value={quarantineTargetId}
                  onChange={(e) => setQuarantineTargetId(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-away/10 text-status-away p-2.5 rounded-lg text-xs text-center font-medium">
                Admin permissions required.
              </div>
            ) : (
              <button
                onClick={() => approveQuarantineAccess(quarantineTargetId, 'approve')}
                className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg text-xs cursor-pointer transition"
              >
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Broadcast Panel */}
        <div className="bg-velum-800 border border-velum-600 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-3">
              <Megaphone className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-xs text-text-primary">
                Broadcast Message
              </h4>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Message
                </label>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Message text..."
                  className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary min-h-[50px] text-xs resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Target
                </label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value as any)}
                  className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary text-xs"
                >
                  <option value="all">All Users</option>
                  <option value="room">Specific Room</option>
                  <option value="user">Specific User</option>
                </select>
              </div>
              {broadcastTarget === 'room' && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Room ID
                  </label>
                  <input
                    type="text"
                    value={broadcastRoomId}
                    onChange={(e) => setBroadcastRoomId(e.target.value)}
                    placeholder="e.g. general"
                    className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  />
                </div>
              )}
              {broadcastTarget === 'user' && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    User ID
                  </label>
                  <input
                    type="number"
                    value={broadcastUserId}
                    onChange={(e) => setBroadcastUserId(e.target.value)}
                    placeholder="User ID"
                    className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' && adminRole !== 'SUPPORT_ADMIN' ? (
              <div className="bg-status-away/10 text-status-away p-2.5 rounded-lg text-xs text-center font-medium">
                Admin permissions required.
              </div>
            ) : (
              <button
                onClick={handleSendBroadcast}
                className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg transition cursor-pointer text-xs"
              >
                Send Broadcast
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
