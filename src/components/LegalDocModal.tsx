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
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[85vh] bg-white text-gray-900 border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center">
              {activeTab === 'terms' ? <FileText className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                Velum Corporation Legal Framework
              </h2>
              <p className="text-xs text-gray-500">
                {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Controls */}
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-200/80 p-1 rounded-lg border border-gray-300">
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'terms'
                    ? 'bg-white text-gray-900 font-semibold shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-white text-gray-900 font-semibold shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Privacy Policy
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition cursor-pointer"
              title="Close Legal Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100/60 custom-scrollbar">
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg p-6 sm:p-10 shadow-sm">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 text-gray-700 animate-spin" />
                <span className="text-xs font-medium tracking-wide">Loading Document...</span>
              </div>
            ) : error ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-status-dnd">
                <span className="text-sm font-medium">{error}</span>
              </div>
            ) : (
              <div 
                className="text-gray-800 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-2 [&_h1]:border-b [&_h1]:border-gray-200 [&_h1]:pb-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-sm [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:text-sm [&_li]:text-gray-700 [&_li]:mb-1 [&_strong]:text-gray-900 [&_strong]:font-semibold [&_.contact-box]:bg-gray-50 [&_.contact-box]:border [&_.contact-box]:border-gray-200 [&_.contact-box]:p-4 [&_.contact-box]:rounded-lg [&_.contact-box]:mt-6 [&_.last-updated]:text-xs [&_.last-updated]:text-gray-500 [&_.last-updated]:mb-4 [&_.entity-title]:text-xs [&_.entity-title]:font-bold [&_.entity-title]:text-gray-500 [&_.entity-title]:uppercase [&_.entity-title]:tracking-wider [&_.entity-title]:mb-1"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>Velum Legal & Regulatory Documentation</span>
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
