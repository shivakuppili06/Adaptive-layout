import { useMemo, useState } from "react";
import { surfaces, validateSurface, type SurfaceKey, type SurfaceProfile } from "./surfaces";
import { resolveLayout } from "./resolver";
import { demoAd } from "./demo-spec";
import { DomRenderer } from "./render-dom";
import { CanvasRenderer } from "./render-canvas";

const SURFACE_LABELS: Record<string, string> = {
  mobilePortrait: "Mobile Portrait",
  mobileLandscape: "Mobile Landscape",
  broadcastLowerThird: "Broadcast Lower-Third",
  retailKiosk: "Retail Kiosk",
  retailKioskCramped: "Retail Kiosk (Cramped)",
  wildcard: "Wildcard Ticket (640×220)",
};

const wildcardSurface: SurfaceProfile = {
  id: "walletTicketStub",
  width: 640,
  height: 220,
  safeArea: { top: 10, right: 14, bottom: 10, left: 14 },
  minTapTarget: 40,
  touchOnly: true,
};

// SVG shapes for the picker groups
const ShapeIcon = ({ type, active }: { type: "portrait" | "wide" | "square"; active: boolean }) => {
  const color = active ? "#fff" : "#6a6e78";
  if (type === "portrait") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/></svg>;
  if (type === "wide") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
};

export default function App() {
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey | "wildcard">("mobilePortrait");
  const [renderer, setRenderer] = useState<"dom" | "canvas">("dom");
  const [debug, setDebug] = useState(false);

  const surface = surfaceKey === "wildcard" ? wildcardSurface : surfaces[surfaceKey];

  const layout = useMemo(() => {
    validateSurface(surface);
    return resolveLayout(demoAd, surface);
  }, [surface]);

  const scale = Math.min(1, 480 / layout.width, 520 / layout.height);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#090a0b", minHeight: "100vh", padding: "48px 32px", color: "#e2e4e9" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em", color: "#fff" }}>
          Adaptive Layout Engine
        </h1>
        <p style={{ color: "#a1a7b3", marginTop: 0, marginBottom: 40, fontSize: 15, maxWidth: 600, lineHeight: 1.5 }}>
          See how Flam ads adapt seamlessly across diverse surfaces from a single declarative spec. 
          No layout branches. No media queries. Pure constraint resolution.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 340px", gap: 40, alignItems: "start" }}>
          {/* LEFT: Controls */}
          <div>
            <div style={{ marginBottom: 32 }}>
              <div style={labelStyle}>Surfaces</div>
              
              <div style={groupLabelStyle}>Portrait</div>
              <PickerBtn active={surfaceKey === "mobilePortrait"} onClick={() => setSurfaceKey("mobilePortrait")} icon="portrait" label={SURFACE_LABELS.mobilePortrait} />
              
              <div style={groupLabelStyle}>Wide</div>
              <PickerBtn active={surfaceKey === "mobileLandscape"} onClick={() => setSurfaceKey("mobileLandscape")} icon="wide" label={SURFACE_LABELS.mobileLandscape} />
              <PickerBtn active={surfaceKey === "broadcastLowerThird"} onClick={() => setSurfaceKey("broadcastLowerThird")} icon="wide" label={SURFACE_LABELS.broadcastLowerThird} />
              <PickerBtn active={surfaceKey === "wildcard"} onClick={() => setSurfaceKey("wildcard")} icon="wide" label={SURFACE_LABELS.wildcard} />

              <div style={groupLabelStyle}>Square</div>
              <PickerBtn active={surfaceKey === "retailKiosk"} onClick={() => setSurfaceKey("retailKiosk")} icon="square" label={SURFACE_LABELS.retailKiosk} />
              <PickerBtn active={surfaceKey === "retailKioskCramped"} onClick={() => setSurfaceKey("retailKioskCramped")} icon="square" label={SURFACE_LABELS.retailKioskCramped} />
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={labelStyle}>Renderer</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRenderer("dom")} style={pickerBtnStyle(renderer === "dom", true)}>DOM</button>
                <button onClick={() => setRenderer("canvas")} style={pickerBtnStyle(renderer === "canvas", true)}>Canvas</button>
              </div>
            </div>

            <div>
              <div style={labelStyle}>Debug</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#a1a7b3", cursor: "pointer" }}>
                <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
                Show minTapTarget bounds
              </label>
            </div>
            
            <div style={{ marginTop: 32, fontSize: 13, color: "#6a6e78", lineHeight: 1.6, padding: "16px", background: "#111318", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Mode:</span> <strong style={{color: "#fff"}}>{layout.mode}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>Dimensions:</span> <strong style={{color: "#fff"}}>{layout.width} × {layout.height}</strong></div>
            </div>
          </div>

          {/* CENTER: Stage */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 520, background: "#111318", borderRadius: 12, border: "1px solid #222630", position: "relative", overflow: "hidden" }}>
            {/* Faint grid background */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#333 1px, transparent 1px)", backgroundSize: "24px 24px", opacity: 0.5 }} />
            
            <div style={{ transform: `scale(${scale})`, transformOrigin: "center center", transition: "transform 400ms cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 1, position: "relative" }}>
              <div style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
                {renderer === "dom" ? <DomRenderer layout={layout} debug={debug} /> : <CanvasRenderer layout={layout} debug={debug} />}
              </div>
            </div>
          </div>

          {/* RIGHT: Trace Panel */}
          <div>
            <div style={labelStyle}>Resolution Trace</div>
            <div style={{ background: "#111318", borderRadius: 8, padding: "16px 12px", border: "1px solid #222630", maxHeight: 520, overflowY: "auto" }}>
              {layout.trace.map((line, i) => {
                let color = "#a1a7b3";
                let icon = "ℹ️";
                if (line.includes("shrunk to its floor")) { color = "#d97706"; icon = "📉"; }
                else if (line.includes("dropped")) { color = "#ef4444"; icon = "❌"; }
                else if (line.includes("minTapTarget") || line.includes("minTextSize")) { color = "#3b82f6"; icon = "🔒"; }
                else if (line.includes("All elements fit")) { color = "#10b981"; icon = "✅"; }
                
                return (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13, lineHeight: 1.5, color }}>
                    <span style={{ flexShrink: 0 }}>{icon}</span>
                    <span>{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'Outfit', sans-serif",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#a1a7b3",
  marginBottom: 12,
};

const groupLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "#6a6e78",
  marginTop: 16,
  marginBottom: 6,
  marginLeft: 4,
};

function PickerBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: "portrait" | "wide" | "square", label: string }) {
  return (
    <button 
      onClick={onClick} 
      style={{
        ...pickerBtnStyle(active, false),
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
      }}
      className={`picker-btn ${active ? 'active' : ''}`}
    >
      <ShapeIcon type={icon} active={active} />
      <span>{label}</span>
      <style>{`
        .picker-btn { transition: all 150ms ease; }
        .picker-btn:hover:not(.active) { background: #1c1f26 !important; border-color: #333946 !important; }
      `}</style>
    </button>
  );
}

function pickerBtnStyle(active: boolean, inline = false): React.CSSProperties {
  return {
    display: inline ? "inline-block" : "block",
    width: inline ? "auto" : "100%",
    textAlign: "left",
    padding: "8px 16px",
    marginBottom: 4,
    borderRadius: 6,
    border: active ? "1px solid #3b82f6" : "1px solid #222630",
    background: active ? "rgba(59, 130, 246, 0.1)" : "transparent",
    color: active ? "#fff" : "#e2e4e9",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
  };
}
