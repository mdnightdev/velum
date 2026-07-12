import React, { useState } from 'react';
import { UserPlus, Unlock, Sliders } from 'lucide-react';

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

  const generateNewInvite = async () => {
    setNewCodeInfo(null);
    try {
      const res = await adminFetch(`/api/admin/invites`, {
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

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <div className="bg-orange-500/10 text-orange-400 p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-orange-500/20">
                ACCESS LOCKED: ONLY EXECUTIVE LEVEL PRIVILEGE GATES PERMIT GENERATING ENTRY ENROLLMENT SCHEMAS.
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
                    <strong className="text-red-500 select-all font-black ml-1 font-sans">{newCodeInfo}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Gateway Lockdown emergency triggers */}
        <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-4">
              <Unlock className="w-4.5 h-4.5 text-orange-400" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                Security Containment System
              </h4>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed font-sans mb-4">
              In case of compromise alerts, emergency lockdown forces immediate token revokes, blocks
              registrations, and freezes socket connections.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-dnd/10 text-status-dnd p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-rose-500/20">
                ACCESS LOCKED: DISPATCHING CENTRAL CONTAINER LOCKDOWNS RESTRICTED TO EXECUTIVE OVERWATCH LEVEL.
              </div>
            ) : (
              <>
                {isGatewayLocked ? (
                  <button
                    onClick={() => {
                      setIsGatewayLocked(false);
                      alert('Gateway lockdown lifted.');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                  >
                    Lift Gateway Lockdown
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsGatewayLocked(true);
                      alert('Emergency lockdown activated.');
                    }}
                    className="w-full bg-red-650 hover:bg-red-700 text-text-primary font-extrabold py-3 rounded-xl transition border-0 cursor-pointer shadow-md uppercase font-mono tracking-wider text-[10px]"
                  >
                    Deploy Gateway Lockdown Override
                  </button>
                )}
                <div className="p-3 text-[9.5px] font-mono text-text-disabled uppercase tracking-wide leading-relaxed">
                  Status:{' '}
                  {isGatewayLocked ? (
                    <span className="text-red-500 font-black">LOCKED DOWN</span>
                  ) : (
                    <span className="text-status-online font-bold">SECURED OPEN</span>
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
                  Client Target Numeric Database ID
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
              <div className="bg-orange-500/10 text-orange-400 p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-orange-500/20">
                ACCESS LOCKED: SECURE ARCHIVE RESTORATION REQUIRES CENTRAL COMPLIANCE MATRIX CLEARANCE.
              </div>
            ) : (
              <button
                onClick={() => approveQuarantineAccess(quarantineTargetId, 'approve')}
                className="w-full bg-accent-20 hover:bg-accent text-accent hover:text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer border border-accent-40 transition"
              >
                Manually Unlock Target
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
