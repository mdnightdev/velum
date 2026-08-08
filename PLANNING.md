# ChatArea Deconstruction Plan

## Overview
`ChatArea.tsx` is a 2,084-line monolithic component performing 9 distinct operational roles:
1. **Header Management**: Active channel/DM info, topic, call controls, drawer toggles.
2. **Message List & Scrolling**: Message grouping, timestamp dividers, auto-scroll to bottom, unread indicators, jump-to-message logic.
3. **Message Item Rendering**: Markdown parsing, media attachments, audio playback, hover action bar, reaction chips.
4. **Interactive Message Actions**: Editing, deletion, pinning, thread creation, reaction pickers, report ticket triggers.
5. **Input / Composer Area**: Auto-growing textarea, attachment uploader, drag-and-drop, draft auto-save, `@` mention auto-completion.
6. **Voice Note Recording**: Web Audio API / MediaRecorder capture, waveform visualization, audio draft preview.
7. **Thread Management**: Side panel for thread conversations and replies.
8. **Search & Pin Drawers**: Full-text message search filtering and pinned message list modals.
9. **Active Call Overlay**: Audio/video call interface header bar.

---

## Deconstruction Strategy

### Phase 1: Custom Hooks Extraction (`src/components/chat/hooks/`)
- `useMessageInput.ts`: Input text, draft auto-save, attachment handling, mention matching.
- `useMessageScroll.ts`: Auto-scroll bottom detection, jump-to-message anchor, scroll event listener.
- `useAudioRecorder.ts`: Microphone permissions, recording timer, audio blob export.
- `useMessageActions.ts`: Reactions, message edit/delete states, pin toggling.

### Phase 2: Core Presentational Components (`src/components/chat/`)
- `ChatHeader.tsx`: Channel/DM title, banner, call triggers, drawer toggle buttons.
- `ChatInput.tsx`: Composer bar, text area, attachment previews, recording trigger, emoji/GIF buttons.

### Phase 3: Message Display Sub-Components (`src/components/chat/`)
- `ChatMessageItem.tsx`: Individual message view, avatar, markdown formatting, reactions, media preview, hover actions.
- `ChatMessageList.tsx`: Virtualized/grouped list rendering, timestamp separators, unread marker, scroll anchors.

### Phase 4: Drawers & Modals (`src/components/chat/`)
- `PinnedMessagesModal.tsx`: Modal for displaying and unpinning saved messages.
- `SearchDrawer.tsx`: Search filter input and matching message results drawer.
- `ThreadPanel.tsx`: Contextual thread drawer for nested replies.

### Phase 5: Final Clean Integration
- Refactor `ChatArea.tsx` into a lightweight, orchestrator component delegating presentational rendering and business logic to the extracted hooks and sub-components.
- Verify full TypeScript compilation and linter passing after each phase.

---

## Next Steps
To begin execution, please authorize with one of the trigger commands:
- `start working`
- `implement phase 1`
- `execute plan`
