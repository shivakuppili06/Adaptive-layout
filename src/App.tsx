import { useMemo, useState } from "react";
import { surfaces, validateSurface, type SurfaceKey, type SurfaceProfile } from "./surfaces";
import { resolveLayout } from "./resolver";
import { demoAd } from "./demo-spec";
import { DomRenderer } from "./render-dom";
import { CanvasRenderer } from "./render-canvas";
import { DOMTextMeasurementProvider } from "./measure-text";

const SURFACE_LABELS: Record<string, string> = {
  mobilePortrait: "Mobile Portrait",
  mobileLandscape: "Mobile Landscape",
  broadcastLowerThird: "Broadcast Lower-Third",
  retailKiosk: "Retail Kiosk",
  retailKioskCramped: "Retail Kiosk (Cramped)",
  wildcard: "Wildcard Ticket (640×220)",
  custom: "Custom Surface",
};

const wildcardSurface: SurfaceProfile = {
  id: "walletTicketStub",
  width: 640,
  height: 220,
  safeArea: { top: 10, right: 14, bottom: 10, left: 14 },
  minTapTarget: 40,
  touchOnly: true,
};

const DEFAULT_CUSTOM: SurfaceProfile = {
  id: "customSurface",
  width: 640,
  height: 220,
  safeArea: { top: 10, right: 14, bottom: 10, left: 14 },
  minTapTarget: 44,
  minTextSize: 18,
  viewingDistance: "near",
  touchOnly: true,
};

const ShapeIcon = ({ type, active }: { type: "portrait" | "wide" | "square"; active: boolean }) => {
  const color = active ? "#fff" : "#6a6e78";
  if (type === "portrait") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/></svg>;
  if (type === "wide") return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
};

export default function App() {
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey | "wildcard" | "custom">("mobilePortrait");
  const [renderer, setRenderer] = useState<"dom" | "canvas">("dom");
  const [debug, setDebug] = useState(false);
  const [customSurface, setCustomSurface] = useState<SurfaceProfile>(DEFAULT_CUSTOM);

  let surface: SurfaceProfile;
  let validationError = "";
  
  if (surfaceKey === "wildcard") surface = wildcardSurface;
  else if (surfaceKey === "custom") surface = customSurface;
  else surface = surfaces[surfaceKey as SurfaceKey];

  const layout = useMemo(() => {
    try {
      validateSurface(surface);
      return resolveLayout(demoAd, surface, DOMTextMeasurementProvider);
    } catch (err: any) {
      validationError = err.message;
      return null;
    }
  }, [surface]);

  const scale = layout ? Math.min(1, 480 / layout.width, 520 / layout.height) : 1;

  const handleCustomChange = (field: keyof SurfaceProfile, value: any) => {
    setCustomSurface(prev => ({ ...prev, [field]: value }));
  };

  const handleSafeChange = (field: keyof typeof DEFAULT_CUSTOM.safeArea, value: number) => {
    setCustomSurface(prev => ({ ...prev, safeArea: { ...prev.safeArea, [field]: value } }));
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#090a0b", minHeight: "100vh", padding: "48px 32px", color: "#e2e4e9" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em", color: "#fff" }}>
          Adaptive Layout Engine
        </h1>
        <p style={{ color: "#a1a7b3", marginTop: 0, marginBottom: 40, fontSize: 15, maxWidth: 600, lineHeight: 1.5 }}>
          See how Flam ads adapt seamlessly across diverse surfaces from a single declarative spec.
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

              <div style={groupLabelStyle}>Custom</div>
              <PickerBtn active={surfaceKey === "custom"} onClick={() => setSurfaceKey("custom")} icon="wide" label={SURFACE_LABELS.custom} />
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
                Show tap target bounds
              </label>
            </div>
          </div>

          {/* CENTER: Stage */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 520, background: "#111318", borderRadius: 12, border: "1px solid #222630", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#333 1px, transparent 1px)", backgroundSize: "24px 24px", opacity: 0.5 }} />
              
              {layout ? (
                <div style={{ transform: `scale(${scale})`, transformOrigin: "center center", transition: "transform 400ms cubic-bezier(0.4, 0, 0.2, 1)", zIndex: 1, position: "relative" }}>
                  <div style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
                    {renderer === "dom" ? <DomRenderer layout={layout} debug={debug} /> : <CanvasRenderer layout={layout} debug={debug} />}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#ef4444", zIndex: 10, padding: 20, textAlign: "center", background: "rgba(239,68,68,0.1)", borderRadius: 8, border: "1px solid #ef4444" }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Surface Validation Error</div>
                  <div style={{ fontSize: 13 }}>{validationError}</div>
                </div>
              )}
            </div>

            {surfaceKey === "custom" && (
              <div style={{ marginTop: 24, padding: 20, background: "#111318", borderRadius: 8, border: "1px solid #222630" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                   <div style={{ ...labelStyle, marginBottom: 0 }}>Custom Surface Builder</div>
                   <button onClick={() => setCustomSurface(DEFAULT_CUSTOM)} style={{ background: "transparent", border: "1px solid #333", color: "#a1a7b3", borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Reset</button>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Width</label>
                    <input type="number" value={customSurface.width} onChange={e => handleCustomChange("width", parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Height</label>
                    <input type="number" value={customSurface.height} onChange={e => handleCustomChange("height", parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Safe Top</label>
                    <input type="number" value={customSurface.safeArea.top} onChange={e => handleSafeChange("top", parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Safe Bottom</label>
                    <input type="number" value={customSurface.safeArea.bottom} onChange={e => handleSafeChange("bottom", parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Safe Left</label>
                    <input type="number" value={customSurface.safeArea.left} onChange={e => handleSafeChange("left", parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Safe Right</label>
                    <input type="number" value={customSurface.safeArea.right} onChange={e => handleSafeChange("right", parseInt(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Min Tap Target</label>
                    <input type="number" value={customSurface.minTapTarget || ""} onChange={e => handleCustomChange("minTapTarget", parseInt(e.target.value) || undefined)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{display: "block", color: "#888", marginBottom: 4}}>Min Text Size</label>
                    <input type="number" value={customSurface.minTextSize || ""} onChange={e => handleCustomChange("minTextSize", parseInt(e.target.value) || undefined)} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                     <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#e2e4e9", cursor: "pointer" }}>
                       <input type="checkbox" checked={!!customSurface.touchOnly} onChange={e => handleCustomChange("touchOnly", e.target.checked)} />
                       Touch Only (Enforces Min Tap Target)
                     </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Inspector Panel */}
          <div>
            <div style={labelStyle}>Resolution Inspector</div>
            
            {layout && (
              <>
                <div style={{ background: "#111318", borderRadius: 8, padding: "16px", border: "1px solid #222630", marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "#6a6e78", lineHeight: 1.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Surface:</span> <strong style={{color: "#fff"}}>{layout.width} × {layout.height}</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>Content Box:</span> <strong style={{color: "#fff"}}>{layout.width - surface.safeArea.left - surface.safeArea.right} × {layout.height - surface.safeArea.top - surface.safeArea.bottom}</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>Mode:</span> <strong style={{color: "#fff", textTransform: "uppercase"}}>{layout.mode}</strong></div>
                  </div>
                  
                  <div style={{ borderTop: "1px solid #222630", margin: "12px 0", paddingTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6a6e78", textTransform: "uppercase", marginBottom: 8 }}>Hard Constraints</div>
                    <div style={{ fontSize: 12, color: "#a1a7b3", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 6 }}><span>✓</span> Safe Area Check</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span>{surface.minTextSize ? "✓" : "○"}</span> 
                        Min Text Size: {surface.minTextSize ? `${surface.minTextSize}px` : "N/A"}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span>{surface.minTapTarget && surface.touchOnly ? "✓" : "○"}</span> 
                        Touch Target: {surface.minTapTarget && surface.touchOnly ? `${surface.minTapTarget}px` : "N/A"}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #222630", margin: "12px 0", paddingTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6a6e78", textTransform: "uppercase", marginBottom: 8 }}>Element Status</div>
                    <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                       {layout.elements.map(el => (
                          <div key={el.id} style={{ display: "flex", justifyContent: "space-between", color: el.visible ? (el.degradation === "shrunk" ? "#d97706" : "#10b981") : "#ef4444" }}>
                            <span>{el.id}</span>
                            <span>{el.visible ? (el.degradation === "shrunk" ? "⚠ Shrunk" : "✓ Visible") : "✕ Dropped"}</span>
                          </div>
                       ))}
                    </div>
                  </div>
                </div>

                <div style={{ background: "#111318", borderRadius: 8, padding: "16px 12px", border: "1px solid #222630", maxHeight: 300, overflowY: "auto" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6a6e78", textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>Algorithm Trace</div>
                  {layout.issues.map((issue, i) => (
                    <div key={`err-${i}`} style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13, lineHeight: 1.5, color: issue.severity === "error" ? "#ef4444" : "#d97706" }}>
                      <span style={{ flexShrink: 0 }}>{issue.severity === "error" ? "❌" : "⚠"}</span>
                      <span>[{issue.constraint}] {issue.message}</span>
                    </div>
                  ))}
                  {layout.trace.map((line, i) => {
                    let color = "#a1a7b3";
                    let icon = "ℹ️";
                    if (line.includes("shrunk to its floor") || line.includes("truncated")) { color = "#d97706"; icon = "📉"; }
                    else if (line.includes("dropped")) { color = "#ef4444"; icon = "❌"; }
                    else if (line.includes("minTapTarget") || line.includes("minTextSize")) { color = "#3b82f6"; icon = "🔒"; }
                    else if (line.includes("All elements fit")) { color = "#10b981"; icon = "✅"; }
                    
                    return (
                      <div key={`trace-${i}`} style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13, lineHeight: 1.5, color }}>
                        <span style={{ flexShrink: 0 }}>{icon}</span>
                        <span>{line}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  background: "#1c1f26",
  border: "1px solid #333946",
  borderRadius: 4,
  color: "#fff",
  fontSize: 13,
  fontFamily: "inherit"
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
