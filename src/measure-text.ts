import type { TextMeasurementProvider } from "./resolver";

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx() {
  if (!measureCtx && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  return measureCtx;
}

export const DOMTextMeasurementProvider: TextMeasurementProvider = {
  measureText(text: string, fontSize: number, maxWidth: number, maxHeight: number, fontWeight: number | string, maxLines?: number) {
    const ctx = getMeasureCtx();
    if (!ctx) return { width: 0, height: 0, lines: 1, fittedText: text, truncated: false };

    ctx.font = `${fontWeight} ${fontSize}px 'Inter', system-ui, sans-serif`;
    const lineHeight = fontSize * 1.2;
    const computedMaxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    const allowedLines = maxLines ? Math.min(maxLines, computedMaxLines) : computedMaxLines;

    const words = text.split(" ");
    let result = "";
    let currentLine = "";
    let lineCount = 1;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth) {
        if (lineCount >= allowedLines) {
          let truncateLine = currentLine;
          while (truncateLine.length > 0 && ctx.measureText(truncateLine + "...").width > maxWidth) {
            truncateLine = truncateLine.slice(0, -1);
          }
          result = result + (result ? "\n" : "") + truncateLine.trim() + "...";
          return { width: maxWidth, height: lineCount * lineHeight, lines: lineCount, fittedText: result, truncated: true };
        }
        result += (result ? "\n" : "") + currentLine;
        currentLine = word;
        lineCount++;
      } else {
        currentLine = testLine;
      }
    }
    
    result = result + (result ? "\n" : "") + currentLine;
    return { 
       width: Math.min(maxWidth, ctx.measureText(currentLine).width), 
       height: lineCount * lineHeight, 
       lines: lineCount, 
       fittedText: result, 
       truncated: false 
    };
  }
};
