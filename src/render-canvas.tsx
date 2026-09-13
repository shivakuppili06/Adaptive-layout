/**
 * render-canvas.tsx — Renders a ResolvedLayout to a <canvas> element.
 *
 * Bonus deliverable: proves the resolver output is renderer-agnostic.
 * Reads exactly the same ResolvedLayout shape as render-dom.tsx and
 * makes zero layout decisions of its own.
 */
import { useEffect, useRef } from "react";
import type { ResolvedLayout } from "./resolver";

const ROLE_COLOR: Record<string, string> = {
  hero: "#2b2f38",
  primary: "#111318",
  action: "#d64545",
  secondary: "#4b5160",
  branding: "#8a8f9c",
};

export function CanvasRenderer({ layout }: { layout: ResolvedLayout }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#f5f4f1";
    ctx.fillRect(0, 0, layout.width, layout.height);

    const images = new Map<string, HTMLImageElement>();
    let pending = 0;

    const draw = () => {
      ctx.clearRect(0, 0, layout.width, layout.height);
      ctx.fillStyle = "#f5f4f1";
      ctx.fillRect(0, 0, layout.width, layout.height);

      for (const el of layout.elements) {
        if (!el.visible) continue;

        if (el.type === "image") {
          const img = el.src ? images.get(el.id) : undefined;
          if (img && img.complete) {
            ctx.drawImage(img, el.x, el.y, el.width, el.height);
          } else {
            ctx.fillStyle = ROLE_COLOR[el.role] ?? "#999";
            ctx.fillRect(el.x, el.y, el.width, el.height);
          }
        } else if (el.type === "button") {
          ctx.fillStyle = ROLE_COLOR.action;
          roundRect(ctx, el.x, el.y, el.width, el.height, 6);
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.font = `600 ${el.fontSize ?? 14}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(el.content ?? "", el.x + el.width / 2, el.y + el.height / 2);
        } else {
          ctx.fillStyle = ROLE_COLOR[el.role] ?? "#111";
          ctx.font = `${el.role === "primary" ? 700 : 500} ${el.fontSize ?? 14}px system-ui, sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          wrapText(ctx, el.content ?? "", el.x, el.y, el.width, el.height, el.fontSize ?? 14);
        }
      }
    };

    for (const el of layout.elements) {
      if (el.type === "image" && el.src && el.visible) {
        const img = new Image();
        pending++;
        img.onload = () => {
          pending--;
          draw();
        };
        img.src = el.src;
        images.set(el.id, img);
      }
    }

    draw();
  }, [layout]);

  return <canvas ref={ref} style={{ borderRadius: 4, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }} />;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  fontSize: number
) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  const lineHeight = fontSize * 1.2;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (cy + lineHeight > y + maxHeight) return;
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line && cy + lineHeight <= y + maxHeight + lineHeight) ctx.fillText(line, x, cy);
}
