import React, { useState } from 'react';
import { UserPlus, Unlock, Sliders, Megaphone } from 'lucide-react';

interface AdminSystemProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
  approveQuarantineAccess: (targetUserId: string, action: 'approve' | 'deny') => Promise<void>;
  c: any;
}

export default function AdminSystem({
  adminId,
  adminRole,
  adminFetch,
  fetchData,
  approveQuarantineAccess,
  c,
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
        alert(data.error || 'Failed key creation.');
      }
    } catch {
      alert('Connection timeout.');
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
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Entry code creation layout */}
        <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
              <UserPlus className="w-4.5 h-4.5 text-accent-hover" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                Issue Entry Code Key
              </h4>
            </div>
            <div className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-2 tracking-widest font-mono">
                  Expiry Days limit
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={invDays}
                    onChange={(e) => setInvDays(parseInt(e.target.value, 10))}
                    className={`p-3 rounded-xl w-24 outline-none text-center font-mono ${c.bgInput}`}
                  />
                  <span className="text-text-secondary text-[10px] font-mono uppercase font-bold">
                    Days Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-away-bg text-status-away p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal">
               ACCESS RESTRICTED: ADMIN PRIVILEGES REQUIRED TO GENERATE INVITE KEYS.
                
              </div>
            ) : (
              <>
                <button
                  onClick={generateNewInvite}
                  className="w-full bg-accent-hover hover:bg-accent text-black font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                >
                  Issue New Entry Validation Key
                </button>
                {newCodeInfo && (
                  <div className="p-3.5 bg-accent-hover/10 border border-accent-hover/15 text-accent-hover rounded-xl font-mono text-xs font-black tracking-wider block text-center uppercase">
                    Verification Key:{' '}
                    <strong className="text-status-danger select-all font-black ml-1 font-sans">{newCodeInfo}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Emergency System Lockdown */}
                <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
                      <Unlock className="w-4.5 h-4.5 text-status-away" />
                      <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                        Emergency System Lockdown
                      </h4>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed font-sans mb-4">
                      In case of security incidents, emergency lockdown revokes active tokens, disables user registration, and closes active socket connections.
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
                      <div className="bg-status-dnd-bg text-status-dnd p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal">
                        ACCESS DENIED:REQUIRES ADMIN PRIVILIGES
                      </div>
                    ) : (
                      <>
                        {isGatewayLocked ? (
                          <button
                            onClick={() => {
                              setIsGatewayLocked(false);
                              alert('System lockdown disabled.');
                            }}
                            className="w-full bg-status-online hover:bg-status-online/80 text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                          >
                            Disable System Lockdown
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setIsGatewayLocked(true);
                              alert('System lockdown enabled.');
                            }}
                            className="w-full bg-status-danger hover:bg-status-danger/80 text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                          >
                            Enable System Lockdown
                          </button>
                        )}
        <div className="p-3 text-[9.5px] font-mono text-text-disabled uppercase tracking-wide leading-relaxed">
                  Status:{' '}
                  {isGatewayLocked ? (
                    <span className="text-status-danger font-black">LOCKED</span>
                  ) : (
                    <span className="text-status-online font-bold">OPEN</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* quarantine checking tool */}
        <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
              <Sliders className="w-4.5 h-4.5 text-accent-hover" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                Manual Account Restore
              </h4>
            </div>
            <div className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-2 tracking-widest font-mono font-bold">
                  Client ID
                </label>
                <input
                  type="text"
                  className={`w-full p-3 rounded-xl outline-none font-mono ${c.bgInput}`}
                  placeholder=""
                  value={quarantineTargetId}
                  onChange={(e) => setQuarantineTargetId(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-away-bg text-status-away p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal">
                ACCESS LOCKED: REQUIRES ADMIN PRIVILEGES
              </div>
            ) : (
              <button
                onClick={() => approveQuarantineAccess(quarantineTargetId, 'approve')}
                className="w-full bg-accent-20 hover:bg-accent text-accent hover:text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer border border-accent-40 transition"
              >
                UNLOCK
              </button>
            )}
          </div>
        </div>

        {/* System Broadcast Panel */}
        <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
              <Megaphone className="w-4.5 h-4.5 text-accent-hover" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                BROADCAST PANEL
              </h4>
            </div>
            <div className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono font-bold">
                  Broadcast Message
                </label>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Enter message content..."
                  className={`w-full p-2.5 rounded-xl outline-none font-sans min-h-[60px] ${c.bgInput}`}
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono font-bold">
                    Target Scope
                  </label>
                  <select
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value as any)}
                    className={`w-full p-2.5 rounded-xl outline-none font-sans ${c.bgInput}`}
                  >
                    <option value="all">All Users</option>
                    <option value="room">Specific Room</option>
                    <option value="user">Specific User</option>
                  </select>
                </div>
                {broadcastTarget === 'room' && (
                  <div>
                    <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono font-bold">
                      Room ID
                    </label>
                    <input
                      type="text"
                      value={broadcastRoomId}
                      onChange={(e) => setBroadcastRoomId(e.target.value)}
                      placeholder="e.g. general"
                      className={`w-full p-2.5 rounded-xl outline-none font-mono ${c.bgInput}`}
                    />
                  </div>
                )}
                {broadcastTarget === 'user' && (
                  <div>
                    <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono font-bold">
                      User ID
                    </label>
                    <input
                      type="number"
                      value={broadcastUserId}
                      onChange={(e) => setBroadcastUserId(e.target.value)}
                      placeholder=""
                      className={`w-full p-2.5 rounded-xl outline-none font-mono ${c.bgInput}`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
                      {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' && adminRole !== 'SUPPORT_ADMIN' ? (
            <div className="bg-status-away-bg text-status-away p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal">
            </div>
          ) : (
              <button
                onClick={handleSendBroadcast}
                className="w-full bg-accent-hover hover:bg-accent text-black font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
              >
                Broadcast
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
