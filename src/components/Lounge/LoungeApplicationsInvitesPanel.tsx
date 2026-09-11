import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { LoungeStaffRole } from './loungeSettingsRoles';

export interface LoungeApplicationsInvitesPanelProps {
  staffRole: LoungeStaffRole;
  manageRequests: any[];
  manageInvites: any[];
  directAddUsername: string;
  setDirectAddUsername: (v: string) => void;
  directAddError: string;
  directAddSuccess: string;
  onReviewRequest: (requestId: string, approve: boolean) => void;
  onDirectAddMember: () => void;
  onRevokeInviteCode: (inviteId: string) => void;
}

export default function LoungeApplicationsInvitesPanel({
  staffRole,
  manageRequests,
  manageInvites,
  directAddUsername,
  setDirectAddUsername,
  directAddError,
  directAddSuccess,
  onReviewRequest,
  onDirectAddMember,
  onRevokeInviteCode,
}: LoungeApplicationsInvitesPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const canReview = staffRole === 'moderator' || staffRole === 'admin' || staffRole === 'owner';
  const canManageInvites = staffRole === 'admin' || staffRole === 'owner';

  const copyCode = (key: string, code: string) => {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000);
  };

  return (
    <div className="space-y-6 px-4 py-4 font-sans">
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Applications
        </h4>
        {(!manageRequests || manageRequests.length === 0) ? (
          <p className="text-sm text-text-secondary py-4">No pending applications.</p>
        ) : (
          <div className="space-y-2">
            {(manageRequests || []).map((req, index) => (
              <div
                key={req.request_id || `req-${index}`}
                className="p-3 rounded-xl flex items-start justify-between gap-3 hover:bg-white-5 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary">@{req.username}</div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Applied {new Date(req.created_at).toLocaleDateString()}
                  </div>
                  {req.reason ? (
                    <p className="text-xs text-text-secondary mt-2 italic">“{req.reason}”</p>
                  ) : null}
                </div>
                {canReview ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onReviewRequest(req.request_id, false)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-status-dnd hover:bg-white-5 rounded-lg transition cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => onReviewRequest(req.request_id, true)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-status-online hover:bg-white-5 rounded-lg transition cursor-pointer"
                    >
                      Approve
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {canManageInvites ? (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Add member
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={directAddUsername}
              onChange={(e) => setDirectAddUsername(e.target.value)}
              placeholder="username"
              className="flex-1 p-2.5 rounded-lg bg-velum-850 text-sm text-text-secondary font-sans outline-none focus:ring-1 focus:ring-accent/30"
            />
            <button
              type="button"
              onClick={onDirectAddMember}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-velum-900 text-sm font-semibold rounded-lg transition cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {directAddError ? <p className="text-xs text-alert-error">{directAddError}</p> : null}
          {directAddSuccess ? <p className="text-xs text-alert-success">{directAddSuccess}</p> : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Invite codes
        </h4>
        {(!manageInvites || manageInvites.length === 0) ? (
          <p className="text-sm text-text-secondary py-4">No invite codes yet.</p>
        ) : (
          <div className="space-y-2">
            {(manageInvites || []).map((inv, index) => {
              const code = String(inv.invite_code || '');
              const id = String(inv.invite_id || index);
              return (
                <div
                  key={inv.invite_id || `inv-${index}`}
                  className="p-3 rounded-xl flex items-center justify-between gap-3 hover:bg-white-5 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-accent font-mono select-all truncate">
                      {code}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCode(`code-${id}`, code)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white-5 transition cursor-pointer"
                      title="Copy invite code"
                      aria-label="Copy invite code"
                    >
                      {copiedKey === `code-${id}` ? (
                        <Check className="w-3.5 h-3.5 text-status-online" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {canManageInvites ? (
                    <button
                      type="button"
                      onClick={() => onRevokeInviteCode(inv.invite_id)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-status-dnd hover:bg-white-5 rounded-lg transition cursor-pointer shrink-0"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
