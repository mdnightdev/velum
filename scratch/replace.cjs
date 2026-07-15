const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-text-primary">

      {/* Upper Navigation Bar */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 bg-black/10 border-white-5">
        {!wsConnected && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-mono font-bold uppercase rounded-lg animate-pulse tracking-widest pointer-events-none z-50">
            reconnecting...
          </div>
        )}

        <div className="flex items-center gap-3">
          {isMobile && onBackToDeck && (
            <button
              onClick={onBackToDeck}
              className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-text-primary/5 cursor-pointer flex items-center justify-center transition-colors"
              title="Back to directory"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            {/* Avatar */}
            {activeChatPeer ? (
              <div 
                className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent overflow-hidden"
              >
                {activeChatPeer.avatar && (activeChatPeer.avatar.startsWith('data:image/') || activeChatPeer.avatar.startsWith('http')) ? (
                  <img src={activeChatPeer.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  activeChatPeer.username.slice(0, 2).toUpperCase()
                )}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent">
                {chatTitle.slice(0, 2).toUpperCase()}
              </div>
            )}
            
            {/* Title & Status */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{chatTitle}</span>
              <span className="text-[11px] text-text-secondary">
                {activeChatPeer ? formatLastSeen(peerPresence) : \`\${conversationMessages.length} Messages\`}
              </span>
            </div>
          </div>
        </div>

        {/* Video and Phone call buttons removed - calling features not implemented */}
      </div>`;

const replacement = `    <div className="flex-1 flex flex-col overflow-hidden bg-transparent text-text-primary">
      <ChatHeader
        wsConnected={wsConnected}
        isMobile={isMobile}
        onBackToDeck={onBackToDeck}
        activeChatPeer={activeChatPeer}
        chatTitle={chatTitle}
        peerPresence={peerPresence}
        conversationMessages={conversationMessages}
      />`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/ChatArea.tsx', code);
  console.log("Replaced");
} else {
  console.log("Not found");
  // Try relaxed replace
  const idx = code.indexOf('{/* Upper Navigation Bar */}');
  const endIdx = code.indexOf('{/* Primary Message Log area */}');
  if (idx > -1 && endIdx > -1) {
    const before = code.substring(0, idx);
    const after = code.substring(endIdx);
    fs.writeFileSync('src/components/ChatArea.tsx', before + `<ChatHeader
        wsConnected={wsConnected}
        isMobile={isMobile}
        onBackToDeck={onBackToDeck}
        activeChatPeer={activeChatPeer}
        chatTitle={chatTitle}
        peerPresence={peerPresence}
        conversationMessages={conversationMessages}
      />\n      ` + after);
    console.log("Replaced relaxed");
  }
}
