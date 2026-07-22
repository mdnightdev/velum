import React from 'react';
import { ShieldCheck, Plus, Trash2, Key, BookOpen } from 'lucide-react';

interface SavedMainDashboardProps {
  savedNotes: string[];
  newSavedNoteText: string;
  setNewSavedNoteText: (val: string) => void;
  isDark?: boolean;
  onSaveNote: (e: React.FormEvent) => void;
  onDeleteNote: (idx: number) => void;
}

export default function SavedMainDashboard({
  savedNotes,
  newSavedNoteText,
  setNewSavedNoteText,
  isDark = true,
  onSaveNote,
  onDeleteNote
}: SavedMainDashboardProps) {
  return (
    <div id="saved_vault_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-6 select-none">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Note Entry */}
        <form onSubmit={onSaveNote} className="glass-card lg:col-span-5 p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Save Private Note</span>
          </h3>

          <div className="space-y-1.5">
            <textarea
              id="vault_new_note_text"
              required
              rows={5}
              value={newSavedNoteText}
              onChange={(e) => setNewSavedNoteText(e.target.value)}
              placeholder="Store private notes, reminders, or code snippets..."
              className="w-full bg-velum-900 border border-white-5 rounded-xl px-3.5 py-2.5 text-xs text-text-primary focus:border-accent focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            id="vault_save_note_btn"
            type="submit"
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-velum-900 text-xs font-bold uppercase rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer font-sans shadow-md"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Save to Vault</span>
          </button>
        </form>

        {/* Existing notes */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-text-secondary font-mono flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Saved Notes ({savedNotes.length})</span>
          </h3>

          {savedNotes.length === 0 ? (
            <div className="text-xs text-text-secondary font-sans leading-relaxed bg-velum-800/40 border border-white-5 rounded-xl p-6 text-center">
              No saved items yet. Create your first note on the left.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedNotes.map((note, idx) => (
                <div key={idx} className="glass-card p-4 flex flex-col justify-between space-y-3 shadow-md relative group rounded-xl">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black tracking-widest text-accent font-mono uppercase">
                        NOTE #{idx + 1}
                      </span>
                      <button
                        id={`delete_note_${idx}`}
                        type="button"
                        onClick={() => onDeleteNote(idx)}
                        className="text-text-disabled hover:text-rose-400 transition hover:bg-rose-500/10 p-1 rounded-lg border-0 bg-transparent cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-text-primary font-sans leading-relaxed break-all select-text font-medium">
                      {note}
                    </p>
                  </div>
                  <div className="text-[9px] font-mono text-text-secondary flex items-center gap-1 pt-2 border-t border-white-5">
                    <ShieldCheck className="w-3 h-3 text-status-online" />
                    <span>Private & Encrypted</span>
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
