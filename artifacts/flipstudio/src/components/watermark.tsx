export function Watermark() {
  return (
    <div
      className="fixed bottom-4 right-5 z-50 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "rgba(139,92,246,0.55)",
          textShadow: "0 0 12px rgba(139,92,246,0.3)",
          fontFamily: "monospace",
        }}
      >
        ✦ Made By Piyush
      </span>
    </div>
  );
}
