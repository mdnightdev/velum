import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { ImageCropperModal } from '../ImageCropperModal';

export interface LoungeInfoPanelProps {
  canEdit: boolean;
  lockPrivacy: boolean;
  loungeName: string;
  editName: string;
  setEditName: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editIconUrl: string;
  setEditIconUrl: (v: string) => void;
  editIsPrivate: boolean;
  setEditIsPrivate: (v: boolean) => void;
  uploadError: string;
  setUploadError: (v: string) => void;
  isSaving: boolean;
  onSave: (iconFile?: Blob | null) => Promise<void>;
  canManageInvites?: boolean;
  inviteCode?: string | null;
  onCreateInviteCode?: () => void;
}

const NAME_MAX = 50;
const ABOUT_MAX = 200;

export default function LoungeInfoPanel({
  canEdit,
  lockPrivacy,
  loungeName,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editIconUrl,
  setEditIconUrl,
  editIsPrivate,
  setEditIsPrivate,
  uploadError,
  setUploadError,
  isSaving,
  onSave,
  canManageInvites = false,
  inviteCode,
  onCreateInviteCode,
}: LoungeInfoPanelProps) {
  const [loungeIconFile, setLoungeIconFile] = useState<Blob | null>(null);
  const [croppingIcon, setCroppingIcon] = useState<{ src: string; fileName: string } | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleIconFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCroppingIcon({ src: reader.result, fileName: file.name });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopyCode = () => {
    if (!inviteCode) return;
    void navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const previewSrc = croppingIcon?.src || previewObjectUrl || editIconUrl || '';
  const toggleDisabled = !canEdit || lockPrivacy || isSaving;
  const isPublic = !editIsPrivate;

  return (
    <div className="flex flex-col gap-5 px-4 py-4 font-sans text-text-primary">
      <section className="flex flex-col items-center gap-2">
        <div className="relative group">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-velum-850 border border-white-5 flex items-center justify-center">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-2xl font-bold text-accent font-mono">
                {(editName || loungeName || 'L').slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          {canEdit ? (
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleIconFileSelect}
                disabled={isSaving}
              />
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              ) : (
                <Upload className="w-5 h-5 text-white" />
              )}
            </label>
          ) : null}
        </div>
        <p className="text-xs text-text-secondary">
          {canEdit ? 'Tap to change avatar' : 'Avatar'}
        </p>
      </section>

      <section className="rounded-2xl bg-velum-850 border border-white-5 p-3.5 space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          Name
        </label>
        <input
          type="text"
          value={editName}
          maxLength={NAME_MAX}
          onChange={(e) => setEditName(e.target.value.slice(0, NAME_MAX))}
          disabled={!canEdit || isSaving}
          className="w-full bg-transparent text-[15px] text-text-primary font-sans outline-none disabled:opacity-50"
        />
        <div className="text-[10px] text-text-secondary text-right tabular-nums">
          {editName.length}/{NAME_MAX}
        </div>
      </section>

      <section className="rounded-2xl bg-velum-850 border border-white-5 p-3.5 space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
          About
        </label>
        <textarea
          value={editDescription}
          maxLength={ABOUT_MAX}
          onChange={(e) => setEditDescription(e.target.value.slice(0, ABOUT_MAX))}
          disabled={!canEdit || isSaving}
          rows={4}
          className="w-full bg-transparent text-[15px] text-text-primary font-sans outline-none resize-none leading-relaxed disabled:opacity-50"
        />
        <div className="text-[10px] text-text-secondary text-right tabular-nums">
          {editDescription.length}/{ABOUT_MAX}
        </div>
      </section>

      <section className="rounded-2xl bg-velum-850 border border-white-5 px-3.5 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-text-primary">Visibility</div>
          <div className="text-xs text-text-secondary mt-0.5">
            {lockPrivacy
              ? 'Official lounge stays public'
              : isPublic
                ? 'Public — anyone can join'
                : 'Private — invite only'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label={isPublic ? 'Public' : 'Private'}
          disabled={toggleDisabled}
          onClick={() => {
            if (toggleDisabled) return;
            setEditIsPrivate(isPublic);
          }}
          className={`relative w-12 h-7 rounded-full shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            isPublic ? 'bg-accent' : 'bg-white-10'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              isPublic ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </section>

      {canManageInvites ? (
        <section className="rounded-2xl bg-velum-850 border border-white-5 px-3.5 py-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[15px] font-medium text-text-primary">Invite code</div>
            {onCreateInviteCode ? (
              <button
                type="button"
                onClick={onCreateInviteCode}
                className="px-3 py-1.5 text-xs font-semibold text-accent hover:bg-white-5 rounded-lg transition cursor-pointer"
              >
                Generate
              </button>
            ) : null}
          </div>
          {inviteCode ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-accent select-all truncate">{inviteCode}</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent hover:bg-white-5 rounded-lg transition cursor-pointer shrink-0"
              >
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No code yet. Tap Generate.</p>
          )}
        </section>
      ) : null}

      {uploadError ? <p className="text-xs text-alert-error">{uploadError}</p> : null}

      {canEdit ? (
        <button
          type="button"
          disabled={isSaving || !editName.trim()}
          onClick={async () => {
            try {
              await onSave(loungeIconFile);
              setLoungeIconFile(null);
              if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                setPreviewObjectUrl(null);
              }
            } catch {
              /* toast from save handler */
            }
          }}
          className="w-full py-3 rounded-2xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-velum-900 text-sm font-semibold transition cursor-pointer"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      ) : null}

      {croppingIcon ? (
        <ImageCropperModal
          imageSrc={croppingIcon.src}
          fileName={croppingIcon.fileName}
          aspectRatio="1:1"
          onCancel={() => setCroppingIcon(null)}
          onCropComplete={(_croppedDataUrl, croppedFile) => {
            if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
            const obj = URL.createObjectURL(croppedFile);
            setPreviewObjectUrl(obj);
            setLoungeIconFile(croppedFile);
            setCroppingIcon(null);
          }}
        />
      ) : null}
    </div>
  );
}
