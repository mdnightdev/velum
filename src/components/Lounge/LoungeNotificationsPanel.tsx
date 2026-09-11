import React, { useEffect, useState } from 'react';
import { velumToast } from '../../utils/toast';
import {
  LoungeNotifLevel,
  getLoungeNotificationPrefs,
  saveLoungeNotificationPrefs,
  levelToMuteRule,
  muteRuleToLevel,
} from '../../utils/loungeNotificationPrefs';
import { getRoomMuteRule, setRoomMuteRule } from '../../utils/pushNotifications';
import { getSessionId } from '../../utils/auth';

export interface LoungeNotificationsPanelProps {
  loungeId: string;
}

const LIVE_LEVELS: { id: Exclude<LoungeNotifLevel, 'mentions'>; label: string; hint: string }[] = [
  { id: 'all', label: 'All messages', hint: 'Notify for every message in this lounge.' },
  { id: 'nothing', label: 'Nothing', hint: 'Mute this lounge completely.' },
];

function ComingRow({
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
      <span className="text-[10px] font-semibold uppercase tracking-wider text-accent shrink-0 px-2 py-1 rounded-lg bg-accent/10">
        Coming
      </span>
    </div>
  );
}

export default function LoungeNotificationsPanel({ loungeId }: LoungeNotificationsPanelProps) {
  const [level, setLevel] = useState<Exclude<LoungeNotifLevel, 'mentions'>>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const local = getLoungeNotificationPrefs(loungeId);
      const localLevel = local.level === 'mentions' ? 'all' : local.level;
      if (!cancelled) setLevel(localLevel);
      try {
        const rule = await getRoomMuteRule(loungeId);
        if (cancelled) return;
        const fromServer = muteRuleToLevel(rule);
        const nextLevel = fromServer === 'mentions' ? 'all' : fromServer;
        saveLoungeNotificationPrefs(loungeId, { level: nextLevel });
        setLevel(nextLevel);
      } catch {
        /* keep local */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loungeId]);

  const saveLevel = async (next: Exclude<LoungeNotifLevel, 'mentions'>) => {
    setLevel(next);
    saveLoungeNotificationPrefs(loungeId, { level: next });
    setSaving(true);
    try {
      const ok = await setRoomMuteRule(loungeId, levelToMuteRule(next));
      if (!ok) {
        const sid = getSessionId();
        const res = await fetch(`/v2/lounges/${loungeId}/mute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sid}`,
          },
          body: JSON.stringify({ mute_rule: levelToMuteRule(next) }),
        });
        if (!res.ok) throw new Error('Failed to save');
      }
      velumToast.success('Notifications updated.');
    } catch {
      velumToast.error('Could not save lounge notifications.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="px-4 py-8 text-sm text-text-secondary">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4 font-sans text-text-primary">
      <p className="text-xs text-text-secondary">
        These settings apply only to this lounge.
      </p>

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Lounge notifications
        </div>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
          {LIVE_LEVELS.map((opt, idx) => {
            const selected = level === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={saving}
                onClick={() => void saveLevel(opt.id)}
                className={`w-full text-left px-3.5 py-3 flex items-start gap-3 transition cursor-pointer hover:bg-white-5 disabled:opacity-60 ${
                  idx > 0 ? 'border-t border-white-5' : ''
                }`}
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected ? 'border-accent' : 'border-text-secondary'
                  }`}
                >
                  {selected ? <span className="w-2 h-2 rounded-full bg-accent" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-text-primary">{opt.label}</span>
                  <span className="block text-xs text-text-secondary mt-0.5">{opt.hint}</span>
                </span>
              </button>
            );
          })}
          <ComingRow
            label="Mentions only"
            hint="Requires lounge @mentions"
            borderTop
          />
        </div>
      </section>

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Message notifications
        </div>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
          <ComingRow label="Show message preview" hint="Needs device notification permissions" />
          <ComingRow label="Sound" borderTop />
          <ComingRow label="Vibrate" borderTop />
        </div>
      </section>

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-0.5">
          Customise
        </div>
        <div className="rounded-2xl bg-velum-850 border border-white-5 overflow-hidden">
          <ComingRow label="Notification style" />
          <ComingRow label="Notification light" borderTop />
          <ComingRow
            label="Do Not Disturb"
            hint="Respect system DND"
            borderTop
          />
        </div>
      </section>
    </div>
  );
}
