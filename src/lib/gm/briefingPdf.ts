// Bound the backing bitmap independently of the PDF's size and screen density.
export function briefingRenderSizes(input: {
  width: number; pageWidth: number; pageHeight: number;
  pixelRatio: number; thumbnail?: boolean;
}) {
  const { width, pageWidth, pageHeight, thumbnail = false } = input;
  if (![width, pageWidth, pageHeight].every((n) => Number.isFinite(n) && n > 0))
    throw new RangeError("Invalid PDF page dimensions");
  const density = Number.isFinite(input.pixelRatio) && input.pixelRatio > 0 ? input.pixelRatio : 1;
  const cssHeight = width * pageHeight / pageWidth;
  let previousRatio = Infinity;
  return [
    { pixels: thumbnail ? 250_000 : 2_500_000, edge: 3072, density: thumbnail ? 1.5 : 2 },
    { pixels: thumbnail ? 100_000 : 750_000, edge: 1536, density: 1 },
  ].map((limit) => {
    const ratio = Math.min(density, limit.density, previousRatio * 0.65,
      Math.sqrt(limit.pixels / (width * cssHeight)), limit.edge / width, limit.edge / cssHeight);
    previousRatio = ratio;
    return {
      scale: width / pageWidth * ratio,
      width: Math.max(1, Math.floor(width * ratio)),
      height: Math.max(1, Math.floor(cssHeight * ratio)), cssHeight,
    };
  });
}

// Never log arbitrary exception messages: they can contain PDF text or signed URLs.
export function briefingPdfFailure(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? error.name : "Error";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const errorName = ["Error", "TypeError", "RangeError", "InvalidStateError", "SecurityError",
    "NotSupportedError", "EncodingError", "UnknownErrorException", "InvalidPDFException",
    "MissingPDFException", "PasswordException"].includes(String(name)) ? String(name) : "Error";
  const errorCode = /memory|allocat|canvas.*(limit|area|size)|out of bounds/i.test(message) ? "memory_limit"
    : /same canvas|multiple render/i.test(message) ? "canvas_in_use"
    : /getContext|canvas.*(null|context)|(?:null|undefined).*canvas/i.test(message) ? "canvas_context"
    : /not a function|not defined|not supported/i.test(message) ? "browser_feature"
    : /image|bitmap|decod/i.test(message) ? "image_decode"
    : /font/i.test(message) ? "font"
    : /fetch|network|HTTP/i.test(message) ? "network" : "other";
  return { errorName, errorCode };
}
