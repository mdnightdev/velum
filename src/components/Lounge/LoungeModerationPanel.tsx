import React from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import type { LoungeStaffRole } from './loungeSettingsRoles';

export interface LoungeModerationPanelProps {
  staffRole: LoungeStaffRole;
  onOpenMembers: () => void;
}

function ComingToggleRow({
  label,
  hint,
  borderTop,
}: {
  label: string;
  hint?: string;
  borderTop?: boolean;
}) {
  return (
    <div
      className={`px-3.5 py-3 flex items-center justify-between gap-3 opacity-55 ${
        borderTop ? 'border-t border-white-5' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-text-primary">{label}</div>
        {hint ? <div className="text-xs text-text-secondary mt-0.5">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent px-2 py-1 rounded-lg bg-accent/10">
          Coming
        </span>
        <div className="w-11 h-6 rounded-full bg-white-10 relative pointer-events-none">
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white/40 shadow" />
        </div>
      </div>
    </div>
  );
}

export default function LoungeModerationPanel({
  staffRole,
  onOpenMembers,
}: LoungeModerationPanelProps) {
  const canMute = staffRole === 'moderator' || staffRole === 'admin' || staffRole === 'owner';
  const canHeavy = staffRole === 'admin' || staffRole === 'owner';
  const canStaff = canMute || canHeavy;

  return (
    <div className="flex flex-col gap-5 px-4 py-4 font-sans text-text-primary">
      {/* Figma: Edit rules — no rules API yet */}
      <section>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden opacity-55">
          <div className="px-3.5 py-3.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-text-primary">Edit rules</div>
              <div className="text-xs text-text-secondary mt-0.5">Lounge house rules</div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent px-2 py-1 rounded-lg bg-accent/10">
              Coming
            </span>
          </div>
        </div>
      </section>

      {/* Figma: Filters — no lounge filter backend */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Filters
        </div>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
          <ComingToggleRow label="Block harmful content" />
          <ComingToggleRow label="Filter sensitive words" borderTop />
          <ComingToggleRow label="Media screening" borderTop />
        </div>
      </section>

      {/* Figma: Safety tools — no slow-mode / auto-mute backend */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Safety tools
        </div>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
          <ComingToggleRow label="Enable slow mode" hint="Limit how often members can post" />
          <ComingToggleRow label="Auto-mute new members" borderTop />
        </div>
      </section>

      {/* Live today: staff actions already on Members */}
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Staff actions
        </div>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
          <div className="px-3.5 py-3 border-b border-white-5">
            <div className="text-[15px] font-medium text-text-primary">Mute</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {canMute ? 'Live on Members — never against the owner.' : 'Not available for your role.'}
            </div>
          </div>
          <div className="px-3.5 py-3 border-b border-white-5">
            <div className="text-[15px] font-medium text-text-primary">Kick / Ban</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {canHeavy ? 'Live on Members — never against the owner.' : 'Admin or owner only.'}
            </div>
          </div>
          <div className="px-3.5 py-3">
            <div className="text-[15px] font-medium text-text-primary">Role changes</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {canHeavy ? 'Promote or demote from Members.' : 'Admin or owner only.'}
            </div>
          </div>
        </div>
        {canStaff ? (
          <button
            type="button"
            onClick={onOpenMembers}
            className="mt-3 w-full py-3 rounded-2xl bg-accent hover:bg-accent-hover text-velum-900 text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1"
          >
            Open Members
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : null}
      </section>
    </div>
  );
}
