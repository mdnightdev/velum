import React, { useEffect, useMemo, useState } from 'react';
import { sortMembersAdminsFirst } from './utils/memberRoster';
import { formatLastSeen } from '../../utils/datetime';

export interface LoungeMembersManagePanelProps {
  members: any[];
  currentUserId: number;
  onSelectMember: (member: any) => void;
}

function roleBadgeClass(role: string): string {
  const r = String(role || 'member').toLowerCase();
  if (r === 'owner') return 'text-accent bg-accent/15';
  if (r === 'admin' || r === 'administrator') return 'text-status-online bg-status-online/15';
  if (r === 'moderator' || r === 'mod') return 'text-status-away bg-status-away/15';
  return 'text-text-secondary bg-white-5';
}

/** Live presence only — never membership status (`active` / muted / banned). */
function memberPresenceKey(member: any): string {
  const live =
    member.last_seen_at ||
    member.presence ||
    member.activityStatus ||
    '';
  return String(live || 'offline').toLowerCase();
}

function statusDotClass(presenceKey: string): string {
  if (presenceKey === 'online') return 'bg-status-online';
  if (presenceKey === 'away' || presenceKey === 'idle') return 'bg-status-away';
  if (presenceKey === 'dnd' || presenceKey === 'busy') return 'bg-status-dnd';
  return 'bg-status-invisible';
}

function presenceLabel(presenceKey: string): string {
  if (presenceKey === 'online') return 'Online';
  if (presenceKey === 'away' || presenceKey === 'idle') return 'Away';
  if (presenceKey === 'dnd' || presenceKey === 'busy') return 'DND';
  if (presenceKey === 'offline') return 'Offline';
  return formatLastSeen(presenceKey);
}

export default function LoungeMembersManagePanel({
  members,
  currentUserId,
  onSelectMember,
}: LoungeMembersManagePanelProps) {
  const orderedMembers = useMemo(() => sortMembersAdminsFirst(members || []), [members]);
  const [liveByUserId, setLiveByUserId] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of orderedMembers) {
      const id = String(m.user_id ?? '');
      if (!id) continue;
      next[id] = memberPresenceKey(m);
    }
    setLiveByUserId(next);
  }, [orderedMembers]);

  useEffect(() => {
    const handlePresence = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const uid = detail.user_id ?? detail.userId;
      if (uid == null) return;
      const key = String(uid);
      const seen = detail.last_seen_at ?? detail.status ?? detail.presence;
      if (seen == null) return;
      setLiveByUserId((prev) => ({ ...prev, [key]: String(seen).toLowerCase() }));
    };
    window.addEventListener('velum-presence-change', handlePresence);
    return () => window.removeEventListener('velum-presence-change', handlePresence);
  }, []);

  return (
    <div className="flex flex-col gap-3 px-4 py-4 font-sans">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary px-0.5">
        Members — {orderedMembers.length}
      </div>

      <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
        {orderedMembers.map((member, index) => {
          const isSelf = String(member.user_id) === String(currentUserId);
          const role = String(member.role || 'member').toLowerCase();
          const name =
            member.displayName || (member.username || '').replace('@', '') || 'Member';
          const showRoleBadge = role !== 'member';
          const presenceKey = liveByUserId[String(member.user_id)] || memberPresenceKey(member);

          return (
            <button
              key={member.user_id || `manage-member-${member.username || index}`}
              type="button"
              onClick={() => onSelectMember(member)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-white-5 transition cursor-pointer ${
                index > 0 ? 'border-t border-white-5' : ''
              }`}
            >
              <div className="relative shrink-0">
                {member.avatarUrl || member.avatar ? (
                  <img
                    src={member.avatarUrl || member.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-velum-800 flex items-center justify-center text-sm font-bold text-accent">
                    {(member.username || '?').replace('@', '').charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-velum-850 ${statusDotClass(
                    presenceKey
                  )}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[15px] font-medium text-text-primary truncate">{name}</span>
                  {isSelf ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent shrink-0">
                      You
                    </span>
                  ) : null}
                  {showRoleBadge ? (
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${roleBadgeClass(
                        role
                      )}`}
                    >
                      {role}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-text-secondary mt-0.5 truncate">
                  {presenceLabel(presenceKey)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
