import React, { useMemo, useState } from 'react';
import { sortMembersAdminsFirst } from './utils/memberRoster';

export interface LoungeTransferPanelProps {
  members: any[];
  currentUserId: number;
  isTransferring: boolean;
  onTransfer: (newOwnerUserId: number) => Promise<void>;
}

export default function LoungeTransferPanel({
  members,
  currentUserId,
  isTransferring,
  onTransfer,
}: LoungeTransferPanelProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const candidates = useMemo(() => {
    return sortMembersAdminsFirst(members || []).filter(
      (m) => String(m.user_id) !== String(currentUserId)
    );
  }, [members, currentUserId]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary leading-relaxed">
        Pick a member to become owner. You will become an admin and lose danger-zone access.
      </p>

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Members
        </div>
        <div className="rounded-xl bg-velum-900/40 border border-white-5 overflow-hidden max-h-64 overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="px-3.5 py-6 text-sm text-text-secondary">No other members to transfer to.</div>
          ) : (
            candidates.map((member, idx) => {
              const id = Number(member.user_id);
              const selected = selectedId === id;
              return (
                <button
                  key={member.user_id || `t-${idx}`}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition cursor-pointer hover:bg-white-5 ${
                    idx > 0 ? 'border-t border-white-5' : ''
                  } ${selected ? 'bg-accent/10' : ''}`}
                >
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-velum-850 flex items-center justify-center text-xs font-bold text-accent">
                      {(member.username || '?').replace('@', '').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate text-text-primary">
                      {member.displayName || (member.username || '').replace('@', '')}
                    </div>
                    <div className="text-xs text-text-secondary uppercase tracking-wide">
                      {member.role || 'member'}
                    </div>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      selected ? 'border-accent bg-accent' : 'border-text-secondary'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </section>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 accent-[var(--color-accent,#c4a484)]"
        />
        <span className="text-sm text-text-secondary">
          I understand I will become an admin and this cannot be undone from danger zone without the new owner.
        </span>
      </label>

      <button
        type="button"
        disabled={!selectedId || !confirmed || isTransferring}
        onClick={() => {
          if (!selectedId) return;
          void onTransfer(selectedId);
        }}
        className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-900 text-sm font-semibold transition cursor-pointer"
      >
        {isTransferring ? 'Transferring...' : 'Transfer ownership'}
      </button>
    </div>
  );
}
