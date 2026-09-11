import React from 'react';
import type { LoungeStaffRole } from './loungeSettingsRoles';

export interface LoungePermissionsPanelProps {
  staffRole: LoungeStaffRole;
  editIsPrivate: boolean;
  setEditIsPrivate: (v: boolean) => void;
  lockPrivacy: boolean;
  canEditAccess: boolean;
  isSaving: boolean;
  onSaveAccess: () => Promise<void>;
}

const ROLES: { role: string; blurb: string }[] = [
  { role: 'Owner', blurb: 'Full control, including danger zone.' },
  { role: 'Admin', blurb: 'Heavy ops — roles, invites, kick/ban.' },
  { role: 'Moderator', blurb: 'Light ops — approve joins, mute.' },
  { role: 'Member', blurb: 'Chat and share invite link.' },
];

export default function LoungePermissionsPanel({
  staffRole,
  editIsPrivate,
  setEditIsPrivate,
  lockPrivacy,
  canEditAccess,
  isSaving,
  onSaveAccess,
}: LoungePermissionsPanelProps) {
  return (
    <div className="space-y-5">
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Role overview
        </div>
        <div className="rounded-xl bg-velum-900/40 border border-white-5 overflow-hidden">
          {ROLES.map((r, idx) => (
            <div
              key={r.role}
              className={`px-3.5 py-3 ${idx > 0 ? 'border-t border-white-5' : ''}`}
            >
              <div className="text-sm font-semibold text-text-primary">{r.role}</div>
              <div className="text-xs text-text-secondary mt-0.5">{r.blurb}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Access
        </div>
        <div className="rounded-xl bg-velum-900/40 border border-white-5 p-3.5 space-y-3">
          <div>
            <div className="text-sm font-medium text-text-primary">Who can join</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {lockPrivacy
                ? 'Official lounge stays public.'
                : editIsPrivate
                  ? 'Private — invite code required.'
                  : 'Public — anyone can join.'}
            </div>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-white-5">
            <button
              type="button"
              disabled={!canEditAccess || lockPrivacy || isSaving}
              onClick={() => setEditIsPrivate(false)}
              className={`flex-1 py-2.5 text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${
                !editIsPrivate ? 'bg-accent text-velum-900' : 'bg-transparent text-text-secondary'
              }`}
            >
              Public
            </button>
            <button
              type="button"
              disabled={!canEditAccess || lockPrivacy || isSaving}
              onClick={() => setEditIsPrivate(true)}
              className={`flex-1 py-2.5 text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${
                editIsPrivate ? 'bg-accent text-velum-900' : 'bg-transparent text-text-secondary'
              }`}
            >
              Private
            </button>
          </div>
          {canEditAccess && !lockPrivacy ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void onSaveAccess()}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-900 text-sm font-semibold transition cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save access'}
            </button>
          ) : null}
          {staffRole === 'moderator' ? (
            <p className="text-xs text-text-secondary">Mods can view access; only admin or owner can change it.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
