import React from 'react';
import { X, Check, Paperclip, Loader2 } from 'lucide-react';
import { resolveMediaUrl, streamFileDirectToCloudStorage } from '../../utils/mediaPipeline';

type ProfileActionModalsProps = {
  displayName: string;
  showBlockModal: boolean;
  setShowBlockModal: (v: boolean) => void;
  showReportModal: boolean;
  showClearModal: boolean;
  setShowClearModal: (v: boolean) => void;
  selectedReportReason: string;
  setSelectedReportReason: (v: string) => void;
  reportDetails: string;
  setReportDetails: (v: string) => void;
  reportAttachments: string[];
  setReportAttachments: React.Dispatch<React.SetStateAction<string[]>>;
  isUploadingAttachment: boolean;
  setIsUploadingAttachment: (v: boolean) => void;
  reportFileInputRef: React.RefObject<HTMLInputElement | null>;
  resetReportModal: () => void;
  onBlock?: () => void;
  onReport?: (reason?: string, attachments?: string[]) => void;
  onDeleteChat?: () => void;
  onClose: () => void;
  triggerFeedback: (msg: string) => void;
};

export default function ProfileActionModals({
  displayName,
  showBlockModal,
  setShowBlockModal,
  showReportModal,
  showClearModal,
  setShowClearModal,
  selectedReportReason,
  setSelectedReportReason,
  reportDetails,
  setReportDetails,
  reportAttachments,
  setReportAttachments,
  isUploadingAttachment,
  setIsUploadingAttachment,
  reportFileInputRef,
  resetReportModal,
  onBlock,
  onReport,
  onDeleteChat,
  onClose,
  triggerFeedback,
}: ProfileActionModalsProps) {
  const handleReportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsUploadingAttachment(true);
      const url = await streamFileDirectToCloudStorage(file, 'media', file.name.split('.').pop() || 'jpg');
      if (url) {
        setReportAttachments((prev) => [...prev, url]);
      }
    } catch (err) {
      console.warn('Failed to upload report attachment:', err);
    } finally {
      setIsUploadingAttachment(false);
      if (reportFileInputRef.current) reportFileInputRef.current.value = '';
    }
  };

  return (
    <>
      {showBlockModal && (
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowBlockModal(false)}
        >
          <div
            className="w-full max-w-sm bg-velum-850 border border-velum-600 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Block {displayName}?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Blocked contacts will no longer be able to message you. You can unblock them at any time.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBlockModal(false);
                  if (onBlock) onBlock();
                  triggerFeedback(`Blocked ${displayName}`);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-alert-error text-white hover:bg-alert-error/80 active:scale-95 transition cursor-pointer"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={resetReportModal}
        >
          <div
            className="w-full max-w-sm bg-velum-850 border border-velum-600 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Report {displayName}</h3>
              <button
                type="button"
                onClick={resetReportModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:bg-white-5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Select a reason for reporting this contact. A confidential support review ticket will be created.
            </p>

            <div className="space-y-1.5 py-1">
              {['Spam', 'Harassment or bullying', 'Impersonation', 'Scam or fraud', 'Inappropriate content'].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReportReason(reason)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                    selectedReportReason === reason
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-velum-800 border-velum-600/60 text-text-secondary hover:text-white'
                  }`}
                >
                  <span>{reason}</span>
                  {selectedReportReason === reason && <Check className="w-4 h-4 text-accent shrink-0" />}
                </button>
              ))}
            </div>

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Additional details (optional)..."
              rows={2}
              className="w-full p-3 rounded-xl bg-velum-900 border border-velum-600/60 text-xs text-white placeholder-text-disabled focus:outline-none focus:border-accent resize-none"
            />

            <div className="space-y-2">
              <input
                ref={reportFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleReportFile}
                className="hidden"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-secondary font-medium">Evidence / Screenshots</span>
                <button
                  type="button"
                  disabled={isUploadingAttachment}
                  onClick={() => reportFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isUploadingAttachment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Attach photo</span>
                    </>
                  )}
                </button>
              </div>

              {reportAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {reportAttachments.map((url, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-velum-600 bg-velum-900 group">
                      <img src={resolveMediaUrl(url)} alt="evidence" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setReportAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-alert-error transition"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={resetReportModal}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const reasonString = reportDetails.trim()
                    ? `${selectedReportReason}: ${reportDetails.trim()}`
                    : selectedReportReason;
                  const atts = [...reportAttachments];
                  resetReportModal();
                  if (onReport) onReport(reasonString, atts);
                  triggerFeedback('Report submitted. Thank you.');
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-alert-error text-white hover:bg-alert-error/80 active:scale-95 transition cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearModal && (
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="w-full max-w-sm bg-velum-850 border border-velum-600 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-text-primary space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Clear chat?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              This will delete all messages in this conversation from your device cache.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-white hover:bg-white-5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  if (onDeleteChat) onDeleteChat();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-alert-error text-white hover:bg-alert-error/80 active:scale-95 transition cursor-pointer"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
