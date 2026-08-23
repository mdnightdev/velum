import React from 'react';
import { ShieldCheck, Plus, Trash2, Key, BookOpen, Menu } from 'lucide-react';

interface SavedMainDashboardProps {
  savedNotes: string[];
  newSavedNoteText: string;
  setNewSavedNoteText: (val: string) => void;
  isDark?: boolean;
  onSaveNote: (e: React.FormEvent) => void;
  onDeleteNote: (idx: number) => void;
  onToggleSidebar?: () => void;
}

export default function SavedMainDashboard({
  savedNotes,
  newSavedNoteText,
  setNewSavedNoteText,
  isDark = true,
  onSaveNote,
  onDeleteNote,
  onToggleSidebar
}: SavedMainDashboardProps) {
  return (
    <div id="saved_vault_dashboard" className="flex-1 bg-transparent p-3 sm:p-4 space-y-4 max-w-5xl mx-auto w-full select-none text-text-primary">
      {onToggleSidebar && (
        <div className="md:hidden pb-2.5 border-b border-velum-600 flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-velum-600 text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
            aria-label="Open sidebar menu"
            title="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-text-primary">Saved Notes</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Note Entry */}
        <form onSubmit={onSaveNote} className="bg-velum-800 border border-velum-600 rounded-xl lg:col-span-5 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-accent" />
            <span>New Note</span>
          </h3>

          <div>
            <textarea
              id="vault_new_note_text"
              required
              rows={4}
              value={newSavedNoteText}
              onChange={(e) => setNewSavedNoteText(e.target.value)}
              className="w-full bg-velum-750 border border-velum-600 rounded-lg px-3 py-2 text-xs text-text-primary focus:border-accent/40 focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            id="vault_save_note_btn"
            type="submit"
            className="w-full py-2 bg-accent hover:bg-accent-hover text-black text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Save Note</span>
          </button>
        </form>

        {/* Existing notes */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Saved Notes ({savedNotes.length})</span>
          </h3>

          {savedNotes.length === 0 ? (
            <div className="text-xs text-text-secondary bg-velum-800 border border-velum-600 rounded-xl p-8 text-center">
              No saved items yet. Create your first note.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedNotes.map((note, idx) => (
                <div key={idx} className="bg-velum-800 border border-velum-600 p-3.5 flex flex-col justify-between space-y-2.5 rounded-xl">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-accent">
                        #{idx + 1}
                      </span>
                      <button
                        id={`delete_note_${idx}`}
                        type="button"
                        onClick={() => onDeleteNote(idx)}
                        className="text-text-secondary hover:text-status-dnd transition p-1 rounded-lg border-0 bg-transparent cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-text-primary leading-relaxed break-all select-text font-normal">
                      {note}
                    </p>
                  </div>
                  <div className="text-[10px] text-text-secondary flex items-center gap-1 pt-2 border-t border-velum-600">
                    <ShieldCheck className="w-3 h-3 text-status-online" />
                    <span>Private note</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
