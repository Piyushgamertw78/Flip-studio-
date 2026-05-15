export function Watermark() {
  return (
    <div className="fixed bottom-2 right-3 pointer-events-none z-50 flex items-center gap-1.5">
      <svg width="14" height="14" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="wmg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#c026d3"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="22" fill="url(#wmg)" opacity="0.5"/>
        <rect x="8" y="30" width="9" height="9" rx="2" fill="rgba(0,0,0,0.4)"/>
        <rect x="8" y="44" width="9" height="9" rx="2" fill="rgba(0,0,0,0.4)"/>
        <rect x="8" y="58" width="9" height="9" rx="2" fill="rgba(0,0,0,0.4)"/>
        <rect x="83" y="30" width="9" height="9" rx="2" fill="rgba(0,0,0,0.4)"/>
        <rect x="83" y="44" width="9" height="9" rx="2" fill="rgba(0,0,0,0.4)"/>
        <rect x="83" y="58" width="9" height="9" rx="2" fill="rgba(0,0,0,0.4)"/>
        <rect x="22" y="18" width="56" height="64" rx="4" fill="rgba(0,0,0,0.25)"/>
        <rect x="27" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.8)"/>
        <rect x="53" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.15)"/>
        <rect x="27" y="48" width="20" height="20" rx="3" fill="rgba(255,255,255,0.15)"/>
        <rect x="53" y="48" width="20" height="20" rx="3" fill="rgba(255,255,255,0.15)"/>
        <line x1="31" y1="35" x2="42" y2="27" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round"/>
        <polygon points="42,27 44,31 40,32" fill="#7c3aed"/>
      </svg>
      <span className="text-[10px] text-white/25 font-medium tracking-wide">FlipStudio</span>
    </div>
  );
}
