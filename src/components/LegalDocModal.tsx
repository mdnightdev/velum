import React, { useState, useEffect } from 'react';
import { X, Shield, FileText, Loader2 } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy';

interface LegalDocModalProps {
  docType: LegalDocType | null;
  onClose: () => void;
}

export function LegalDocModal({ docType, onClose }: LegalDocModalProps) {
  const [activeTab, setActiveTab] = useState<LegalDocType>(docType || 'terms');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (docType) {
      setActiveTab(docType);
    }
  }, [docType]);

  useEffect(() => {
    if (!docType) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const endpoint = activeTab === 'terms' ? '/terms' : '/privacy';

    fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load document');
        const text = await res.text();
        if (!isMounted) return;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const bodyContent = doc.body ? doc.body.innerHTML : text;
        setContent(bodyContent);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Unable to load document content.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, docType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!docType) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-[85vh] bg-[#0c0c0e] text-zinc-300 border border-zinc-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-accent flex items-center justify-center">
              {activeTab === 'terms' ? <FileText className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <p className="text-xs text-zinc-500 font-mono">Velum Legal Framework</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'terms'
                    ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Privacy
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Formatted Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-7 h-7 animate-spin text-accent" />
              <span className="text-xs">Loading legal framework...</span>
            </div>
          ) : error ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-red-400">
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <div
              className="max-w-2xl mx-auto space-y-4 text-zinc-300 text-sm leading-relaxed
                [&_.brand]:text-xs [&_.brand]:font-bold [&_.brand]:tracking-widest [&_.brand]:text-accent [&_.brand]:uppercase [&_.brand]:mb-1
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:tracking-tight [&_h1]:mb-1
                [&_.date]:text-xs [&_.date]:text-zinc-500 [&_.date]:mb-6 [&_.date]:pb-4 [&_.date]:border-b [&_.date]:border-zinc-800/80
                [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zinc-100 [&_h2]:pt-4 [&_h2]:pb-1
                [&_p]:text-zinc-400 [&_p]:leading-relaxed [&_p]:mb-3
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-4 [&_ul]:text-zinc-400
                [&_li]:leading-relaxed
                [&_strong]:text-zinc-200 [&_strong]:font-semibold
                [&_.contact]:mt-6 [&_.contact]:p-4 [&_.contact]:rounded-xl [&_.contact]:bg-zinc-900/50 [&_.contact]:border [&_.contact]:border-zinc-800/80"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
