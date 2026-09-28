"use client";

import { useEffect, useState, type RefObject } from "react";

export function useChartViewportWidth(ref: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;
    const measure = () => {
      const nextWidth = Math.floor(viewport.clientWidth);
      if (nextWidth > 0)
        setWidth((previous) => (previous === nextWidth ? previous : nextWidth));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
