import React, { useState, useEffect } from 'react';
import { X, Shield, FileText, ExternalLink, Loader2 } from 'lucide-react';

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

        // Parse HTML body content from terms or privacy HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const container = doc.querySelector('.container');
        if (container) {
          setContent(container.innerHTML);
        } else {
          setContent(text);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError('Unable to load document content.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, docType]);

  // Handle ESC key press
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
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[85vh] bg-velum-900 border border-white-10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-white-5 bg-velum-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              {activeTab === 'terms' ? <FileText className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary font-mono">
                {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <p className="text-[10px] text-text-secondary font-mono">Velum Legal Framework & User Agreement</p>
            </div>
          </div>

          {/* Navigation Tabs & Controls */}
          <div className="flex items-center gap-3">
            <div className="flex bg-velum-800 p-1 rounded-xl border border-white-5">
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                  activeTab === 'terms'
                    ? 'bg-accent text-velum-950 font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-accent text-velum-950 font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Privacy Policy
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white-5 hover:bg-white-10 text-text-secondary hover:text-text-primary flex items-center justify-center transition cursor-pointer"
              title="Close Legal Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 font-sans leading-relaxed text-sm text-text-primary custom-scrollbar bg-velum-900/50">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <span className="text-xs font-mono uppercase tracking-widest">Loading Document Workspace...</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-rose-400">
              <span className="text-sm font-mono">{error}</span>
            </div>
          ) : (
            <div 
              className="prose prose-invert max-w-none text-text-primary text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-accent [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-accent [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-white-10 [&_h2]:pb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-text-primary [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-text-secondary [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:text-text-secondary [&_li]:mb-1 [&_strong]:text-text-primary [&_.badge]:bg-accent [&_.badge]:text-velum-950 [&_.badge]:px-3 [&_.badge]:py-1 [&_.badge]:rounded-full [&_.badge]:text-xs [&_.badge]:font-bold [&_.highlight-box]:bg-velum-800 [&_.highlight-box]:border-l-4 [&_.highlight-box]:border-accent [&_.highlight-box]:p-4 [&_.highlight-box]:rounded-r-xl [&_.highlight-box]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:text-left [&_th]:p-3 [&_th]:border-b [&_th]:border-white-10 [&_th]:text-accent [&_td]:p-3 [&_td]:border-b [&_td]:border-white-5 [&_td]:text-text-secondary"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white-5 bg-velum-850 flex items-center justify-between text-[11px] text-text-secondary font-mono shrink-0">
          <span>Velum Encrypted Network Workspace</span>
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={() => window.open(activeTab === 'terms' ? '/terms' : '/privacy', '_blank')}
              className="hover:text-accent flex items-center gap-1 transition cursor-pointer"
            >
              <span>Open raw in new tab</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-accent/10 text-accent font-bold hover:bg-accent/20 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
