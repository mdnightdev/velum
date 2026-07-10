You are absolutely right, and I apologize. I clearly missed the crucial detail that you already defined .glass-panel and .glass-card in your index.css.

You defined:

· .glass-panel → backdrop-filter: blur(24px)
· .glass-card → backdrop-filter: blur(12px)

When you nest a .glass-card inside a .glass-panel, the browser stacks the blur effects (24px + 12px composited). This creates that darker, "double-vision" frosted glass look.

Since you want the glass UI to affect the entire app, the solution is to apply the blur only once at the very root of your application, and strip the backdrop-filter from all inner child components globally.

Here is the exact fix for your index.css and your root layout to make a single, unified, scrollable glass container for the whole app.

1. Update your index.css (Add these overrides)

Add these rules right after your existing .glass-input definition. This ensures that any .glass-card placed inside a .glass-panel loses its blur but keeps the beautiful translucent look:

```css
/* index.css */

/* --- ADD THIS: Unified Root Scrollable Glass --- */
.glass-panel {
  /* Keep your existing styles, but ensure it can scroll */
  max-height: 100vh;
  height: 100vh;           /* or '100%' if inside a flex container */
  overflow-y: auto;        /* Makes the ENTIRE app scrollable */
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

/* --- ADD THIS: Neutralize inner glass to prevent double-blur --- */
.glass-panel .glass-card {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  /* Keep the background and border so it still looks glassy */
  background-color: rgba(255, 255, 255, 0.03); /* Slightly lighter than panel for depth */
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* --- (Optional) If you use .glass-input inside, they already have no blur, so they are safe --- */
```

Why this works: The root .glass-panel provides the beautiful 24px blur over your background gradient. The inner .glass-card now only provides a subtle transparent background and border—zero blur—resulting in a pristine, single unified glass aesthetic.

---

2. Apply it to your Root Layout (e.g., App.tsx or Layout.tsx)

Wrap your entire application with a single .glass-panel. Because we set overflow-y: auto on it, the whole app will scroll smoothly inside the glass box.

```tsx
// App.tsx or RootLayout.tsx
import React from 'react';
import './index.css'; // Your updated CSS

function App() {
  return (
    // The ONE unified glass container for the ENTIRE app
    <div className="glass-panel w-screen max-w-full p-6 md:p-10 text-white">
      
      {/* Everything inside here is a child. Use glass-card for sections */}
      <header className="flex justify-between items-center pb-6 border-b border-white/5 mb-8">
        <h1 className="text-2xl font-bold tracking-wider uppercase">
          VELUM <span className="font-light opacity-40">CONTROL CENTER</span>
        </h1>
        <span className="text-xs font-semibold tracking-wider uppercase text-white/30 bg-white/5 px-4 py-2 rounded-full border border-white/5">
          ● SECURE
        </span>
      </header>

      {/* Metrics Grid - using glass-card (blur is now stripped globally) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {[ 
          { label: 'Total Cases Logged', value: '0', sub: 'dossiers' },
          { label: 'Active Investigation State', value: '0', sub: 'requires review' },
          { label: 'Pending Decisions Queue', value: '0', sub: 'hold locks' },
          { label: 'Resolved Case Files', value: '0', sub: 'secured dockets', accent: true }
        ].map((item) => (
          <div key={item.label} className="glass-card p-5 hover:bg-white/10 transition-all">
            <div className="text-xs font-semibold tracking-wider uppercase text-white/30">{item.label}</div>
            <div className={`text-3xl font-bold ${item.accent ? 'text-emerald-400' : 'text-white'}`}>{item.value}</div>
            <div className="text-xs text-white/20">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Case Registry Section */}
      <div className="text-xs font-semibold tracking-widest uppercase text-white/25 border-t border-white/5 pt-6 mb-4">
        CASE DOCKET REGISTRY
      </div>

      {/* Filter Bar - using simple buttons (no glass needed) */}
      <div className="flex gap-2 flex-wrap mb-4">
        {['All Statuses', 'Active', 'Pending', 'Resolved'].map((label) => (
          <button key={label} className="px-4 py-1.5 rounded-full text-xs font-medium border transition bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/70">
            {label}
          </button>
        ))}
      </div>

      {/* Table - wrapped in glass-card (blur is off) */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase text-white/20 border-b border-white/5">
              <th className="py-3 text-left px-4">Case ID</th>
              <th className="py-3 text-left px-4">Title</th>
              <th className="py-3 text-left px-4">Status</th>
              <th className="py-3 text-left px-4">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="text-center py-12 text-white/15">
                <span className="block text-4xl mb-2 opacity-30">📋</span>
                No cases registered yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add more content here to test scrolling */}
      <div className="h-10"></div>

    </div>
  );
}

export default App;
```

---

What changed?

1. One Glass to rule them all: The blur(24px) now lives exclusively on the outer <div className="glass-panel">.
2. Global scope: Because it wraps your entire app, every page, modal, and sidebar you render inside it will inherit this beautiful, unified background without stacking blurs.
3. Scrollable: The app container itself now handles scrolling (overflow-y: auto), so if your dashboard grows, the glass background stays fixed and beautiful while the content moves inside it.
4. Preserved aesthetics: Inner cards still have the translucent background-color and delicate borders, so they visually "sit" on the glass without causing a double-fog effect.
