import { useMemo, useState } from "react";
import { surfaces, validateSurface, type SurfaceKey, type SurfaceProfile } from "./surfaces";
import { resolveLayout } from "./resolver";
import { demoAd } from "./demo-spec";
import { DomRenderer } from "./render-dom";
import { CanvasRenderer } from "./render-canvas";

const SURFACE_LABELS: Record<SurfaceKey, string> = {
  mobilePortrait: "Mobile Portrait",
  mobileLandscape: "Mobile Landscape",
  broadcastLowerThird: "Broadcast Lower-Third",
  retailKiosk: "Retail Kiosk (square)",
  retailKioskCramped: "Retail Kiosk — Cramped (degradation demo)",
};

// A stand-in for the "unknown 5th surface" the live interview introduces.
// Defined completely outside surfaces.ts to prove the resolver needs no
// prior knowledge of it — only a valid SurfaceProfile shape.
const wildcardSurface: SurfaceProfile = {
  id: "walletTicketStub",
  width: 640,
  height: 220,
  safeArea: { top: 10, right: 14, bottom: 10, left: 14 },
  minTapTarget: 40,
  touchOnly: true,
};

export default function App() {
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey | "wildcard">("mobilePortrait");
  const [renderer, setRenderer] = useState<"dom" | "canvas">("dom");

  const surface = surfaceKey === "wildcard" ? wildcardSurface : surfaces[surfaceKey];

  const layout = useMemo(() => {
    validateSurface(surface);
    return resolveLayout(demoAd, surface);
  }, [surface]);

  const scale = Math.min(1, 380 / layout.width, 420 / layout.height);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#eceae4", minHeight: "100vh", padding: 32 }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Adaptive Layout Engine</h1>
        <p style={{ color: "#5b5f6a", marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          One ad spec, resolved live into a different composition per surface. No per-surface layout branches — see
          resolver.ts.
        </p>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 260px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#8a8f9c", marginBottom: 8 }}>
                Surface
              </div>
              {(Object.keys(surfaces) as SurfaceKey[]).map((key) => (
                <button key={key} onClick={() => setSurfaceKey(key)} style={pickerBtnStyle(surfaceKey === key)}>
                  {SURFACE_LABELS[key]}
                </button>
              ))}
              <button onClick={() => setSurfaceKey("wildcard")} style={pickerBtnStyle(surfaceKey === "wildcard")}>
                Wildcard 5th surface (640×220)
              </button>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#8a8f9c", marginBottom: 8 }}>
                Renderer
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRenderer("dom")} style={pickerBtnStyle(renderer === "dom", true)}>
                  DOM
                </button>
                <button onClick={() => setRenderer("canvas")} style={pickerBtnStyle(renderer === "canvas", true)}>
                  Canvas
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, fontSize: 12, color: "#5b5f6a", lineHeight: 1.6 }}>
              <div>
                <strong>Mode:</strong> {layout.mode}
              </div>
              <div>
                <strong>Surface:</strong> {layout.width}×{layout.height}
              </div>
            </div>
          </div>

          <div style={{ flex: "1 1 420px", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top center", transition: "transform 300ms ease" }}>
              <div key={surfaceKey + renderer} style={{ animation: "fadeIn 220ms ease" }}>
                {renderer === "dom" ? <DomRenderer layout={layout} /> : <CanvasRenderer layout={layout} />}
              </div>
            </div>
          </div>

          <div style={{ flex: "0 0 280px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#8a8f9c", marginBottom: 8 }}>
              Resolution trace
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.6,
                color: "#333",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {layout.trace.map((line, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function pickerBtnStyle(active: boolean, inline = false): React.CSSProperties {
  return {
    display: inline ? "inline-block" : "block",
    width: inline ? "auto" : "100%",
    textAlign: "left",
    padding: "8px 12px",
    marginBottom: 6,
    borderRadius: 6,
    border: active ? "1px solid #111318" : "1px solid #d8d5cc",
    background: active ? "#111318" : "#fff",
    color: active ? "#fff" : "#333",
    fontSize: 13,
    cursor: "pointer",
  };
}
