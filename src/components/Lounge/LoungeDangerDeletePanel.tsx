import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

export interface LoungeDangerDeletePanelProps {
  loungeName: string;
  onDeleteLounge: () => void;
}

export default function LoungeDangerDeletePanel({
  loungeName,
  onDeleteLounge,
}: LoungeDangerDeletePanelProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-alert-error/30 bg-alert-error/10 p-4 space-y-3">
        <div className="flex items-center gap-2 text-alert-error">
          <Trash2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">Delete {loungeName}</span>
        </div>
        <ul className="text-sm text-text-secondary space-y-1.5 list-disc pl-4">
          <li>All rooms and messages in this lounge</li>
          <li>Member list and invite codes</li>
          <li>Lounge settings and history</li>
        </ul>
        <p className="text-sm font-semibold text-alert-error">This cannot be undone.</p>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-text-secondary">
          I understand and want to delete this lounge.
        </span>
      </label>

      <button
        type="button"
        disabled={!confirmed}
        onClick={onDeleteLounge}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-alert-error hover:bg-alert-error/90 disabled:opacity-40 text-white text-sm font-semibold transition cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        Delete Lounge
      </button>
    </div>
  );
}
