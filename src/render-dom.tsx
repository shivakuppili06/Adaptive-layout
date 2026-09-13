import type { ResolvedLayout } from "./resolver";

const ROLE_COLOR: Record<string, string> = {
  hero: "#16181d",
  primary: "#0f172a",
  action: "#3b82f6",
  secondary: "#475569",
  branding: "#334155",
};

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#0f172a" : "#ffffff";
}

export function DomRenderer({ layout, debug }: { layout: ResolvedLayout; debug?: boolean }) {
  return (
    <div
      role="region"
      aria-label="Ad Layout"
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
              border: debug && isAction ? "2px dashed #ef4444" : "none",
              backgroundColor: debug && isAction ? "rgba(239, 68, 68, 0.1)" : "transparent",
            }}
          >
            {el.type === "image" ? (
              el.src ? (
                <img
                  src={el.src}
                  alt={el.role === "branding" ? "Brand Logo" : "Ad visual"}
                  role={el.role === "branding" ? "img" : "presentation"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: el.role === "branding" ? 4 : 2 }}
                />
              ) : (
                <div
                  role="presentation"
                  aria-hidden="true"
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
                aria-label={el.content}
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
                {el.content}
              </button>
            ) : (
              <span
                role={el.role === "primary" ? "heading" : "text"}
                aria-level={el.role === "primary" ? 2 : undefined}
                style={{
                  fontSize: el.fontSize ?? 14,
                  fontWeight: el.role === "primary" ? 700 : 500,
                  color: el.role === "primary" ? "#0f172a" : "#475569",
                  lineHeight: 1.2,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                }}
              >
                {el.content}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
