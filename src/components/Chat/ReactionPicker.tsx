import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ReactionPickerProps {
  isMe: boolean;
  onSelectReaction: (emoji: string) => void;
  availableReactions?: string[];
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '👏', '🙏', '🎉', '💯', '💩'];

const EXTENDED_EMOJIS = [
  '🥳', '😍', '😭', '🤯', '😎', '🫡', '🤔', '🥺', '🤩', '😴',
  '👀', '🚀', '⚡', '✨', '💎', '🥂', '🤝', '💪', '🧠', '👑',
  '👻', '🤡', '🖤', '💔', '💯', '🎯', '🔥', '🏆', '⭐', '🍀'
];

export function ReactionPicker({
  isMe,
  onSelectReaction,
  availableReactions = QUICK_REACTIONS
}: ReactionPickerProps) {
  const [showExtended, setShowExtended] = useState(false);

  return (
    <div
      data-reaction-picker="true"
      className={`absolute -top-14 sm:-top-16 bg-velum-850/98 backdrop-blur-xl border border-accent/30 p-1.5 rounded-2xl flex flex-col gap-2 shadow-2xl z-[100] transition-all animate-in fade-in zoom-in-95 duration-150 ${
        isMe ? 'right-0' : 'left-0'
      }`}
    >
      <div className="flex items-center gap-1">
        {availableReactions.map((reaction) => (
          <button
            key={reaction}
            type="button"
            onClick={() => onSelectReaction(reaction)}
            className="hover:scale-130 active:scale-95 transition-transform p-1.5 text-base sm:text-lg cursor-pointer rounded-xl hover:bg-white-10 emoji-font"
            title={`React ${reaction}`}
          >
            {reaction}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowExtended(!showExtended)}
          className="p-1.5 rounded-xl hover:bg-white-10 text-text-secondary hover:text-white transition cursor-pointer flex items-center justify-center text-xs font-bold"
          title="More reactions"
        >
          {showExtended ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {showExtended && (
        <div className="grid grid-cols-6 gap-1 p-2 border-t border-white-5 max-w-[240px]">
          {EXTENDED_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelectReaction(emoji);
                setShowExtended(false);
              }}
              className="hover:scale-125 transition-transform p-1.5 text-base cursor-pointer rounded-lg hover:bg-white-10 flex items-center justify-center emoji-font"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
