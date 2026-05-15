export function Watermark({ position = "bottom-right" }: { position?: "bottom-right" | "bottom-left" | "top-right" }) {
    const posClass =
      position === "bottom-left"  ? "bottom-2 left-3"  :
      position === "top-right"    ? "top-2 right-3"    :
                                    "bottom-2 right-3";
    return (
      <div className={`fixed ${posClass} pointer-events-none z-50 flex items-center gap-1.5`}>
        <svg width="14" height="14" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="wmg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed"/>
              <stop offset="100%" stopColor="#c026d3"/>
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="22" fill="url(#wmg)" opacity="0.6"/>
          <text x="50" y="62" textAnchor="middle" fontSize="52" fontWeight="900" fill="white" fontFamily="system-ui">P</text>
        </svg>
        <span className="text-[10px] text-white/30 font-semibold tracking-wide">Made By Piyush</span>
      </div>
    );
  }
  