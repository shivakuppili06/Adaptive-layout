/**
 * render-dom.tsx — Renders a ResolvedLayout to real DOM/CSS.
 *
 * Deliberately dumb: this component reads x/y/width/height/fontSize off
 * each ResolvedElement and positions it absolutely. It contains zero
 * layout decisions — every number it uses was already decided by
 * resolver.ts. Swapping this file for a Canvas renderer (see
 * render-canvas.tsx) requires no change to resolver.ts.
 */
import type { ResolvedLayout } from "./resolver";

const ROLE_COLOR: Record<string, string> = {
  hero: "#2b2f38",
  primary: "#111318",
  action: "#d64545",
  secondary: "#4b5160",
  branding: "#8a8f9c",
};

export function DomRenderer({ layout }: { layout: ResolvedLayout }) {
  return (
    <div
      style={{
        position: "relative",
        width: layout.width,
        height: layout.height,
        background: "#f5f4f1",
        overflow: "hidden",
        borderRadius: 4,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
      }}
    >
      {layout.elements
        .filter((el) => el.visible)
        .map((el) => (
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
              justifyContent: el.role === "action" ? "center" : "flex-start",
              overflow: "hidden",
              boxSizing: "border-box",
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
                    background: ROLE_COLOR[el.role],
                    borderRadius: el.role === "branding" ? 4 : 2,
                  }}
                />
              )
            ) : el.type === "button" ? (
              <button
                style={{
                  width: "100%",
                  height: "100%",
                  background: ROLE_COLOR.action,
                  color: "white",
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
                style={{
                  fontSize: el.fontSize ?? 14,
                  fontWeight: el.role === "primary" ? 700 : 500,
                  color: ROLE_COLOR[el.role],
                  lineHeight: 1.15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: Math.max(1, Math.floor(el.height / ((el.fontSize ?? 14) * 1.2))),
                  WebkitBoxOrient: "vertical",
                  fontFamily: "inherit",
                }}
              >
                {el.content}
              </span>
            )}
          </div>
        ))}
    </div>
  );
}
