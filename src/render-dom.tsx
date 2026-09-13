import type { ResolvedLayout } from "./resolver";

const ROLE_COLOR: Record<string, string> = {
  hero: "#16181d",
  primary: "#0f172a",
  action: "#3b82f6",
  secondary: "#475569",
  branding: "#334155",
};

// Simple luminance calculation to determine contrast color
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#0f172a" : "#ffffff";
}

// Global hidden canvas for precise text measurement
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx() {
  if (!measureCtx && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d");
  }
  return measureCtx;
}

function truncateTextToFit(text: string, maxWidth: number, maxHeight: number, fontSize: number, fontWeight: number | string): string {
  const ctx = getMeasureCtx();
  if (!ctx) return text; // Fallback for SSR

  ctx.font = `${fontWeight} ${fontSize}px 'Inter', system-ui, sans-serif`;
  const lineHeight = fontSize * 1.2;
  const maxLines = Math.floor(maxHeight / lineHeight);
  if (maxLines <= 0) return "";

  const words = text.split(" ");
  let result = "";
  let currentLine = "";
  let lineCount = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth) {
      if (lineCount >= maxLines) {
        // We're on the last line, need to append ellipsis and break
        let truncateLine = currentLine;
        while (truncateLine.length > 0 && ctx.measureText(truncateLine + "...").width > maxWidth) {
          truncateLine = truncateLine.slice(0, -1);
        }
        return result + (result ? " " : "") + truncateLine.trim() + "...";
      }
      result += (result ? " " : "") + currentLine;
      currentLine = word;
      lineCount++;
    } else {
      currentLine = testLine;
    }
  }
  
  return result + (result ? " " : "") + currentLine;
}

export function DomRenderer({ layout, debug }: { layout: ResolvedLayout; debug?: boolean }) {
  // We keep all elements in the DOM to animate their exit (when visible becomes false)
  return (
    <div
      style={{
        position: "relative",
        width: layout.width,
        height: layout.height,
        background: "#ffffff",
        overflow: "hidden",
        borderRadius: 4,
        transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1), height 400ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {layout.elements.map((el) => {
        const isAction = el.role === "action";
        const bgColor = ROLE_COLOR[el.role] || "#94a3b8";
        const textColor = getContrastColor(bgColor);
        
        // Text measurement-aware content mapping
        let displayContent = el.content;
        if (el.visible && (el.type === "text" || el.type === "button") && el.content) {
            displayContent = truncateTextToFit(
              el.content, 
              el.width, 
              el.height, 
              el.fontSize ?? 14, 
              el.role === "primary" ? 700 : (el.type === "button" ? 600 : 500)
            );
        }

        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              display: "flex",
              alignItems: "center",
              justifyContent: isAction ? "center" : "flex-start",
              overflow: "hidden",
              boxSizing: "border-box",
              opacity: el.visible ? 1 : 0,
              transform: el.visible ? "scale(1)" : "scale(0.95)",
              pointerEvents: el.visible ? "auto" : "none",
              transition: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: el.visible ? 10 : 1,
              // Debug Outline for tap targets
              border: debug && isAction ? "2px dashed #ef4444" : "none",
              backgroundColor: debug && isAction ? "rgba(239, 68, 68, 0.1)" : "transparent",
            }}
          >
            {el.type === "image" ? (
              el.src ? (
                <img
                  src={el.src}
                  alt={el.id}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: el.role === "branding" ? 4 : 2 }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: bgColor,
                    borderRadius: el.role === "branding" ? 4 : 2,
                  }}
                />
              )
            ) : el.type === "button" ? (
              <button
                style={{
                  width: "100%",
                  height: "100%",
                  background: bgColor,
                  color: textColor,
                  border: "none",
                  borderRadius: 6,
                  fontSize: el.fontSize ?? 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {displayContent}
              </button>
            ) : (
              <span
                style={{
                  fontSize: el.fontSize ?? 14,
                  fontWeight: el.role === "primary" ? 700 : 500,
                  color: el.role === "primary" ? "#0f172a" : "#475569",
                  lineHeight: 1.2,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                }}
              >
                {displayContent}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
