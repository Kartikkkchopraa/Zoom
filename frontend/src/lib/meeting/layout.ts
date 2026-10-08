"use client";

import { useEffect, useRef, useState } from "react";

/** Live size of an element (via ResizeObserver). */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Gallery view layout: pick the column count that makes n 16:9 tiles as large
 * as possible inside the container (what Zoom's gallery does).
 */
export function fitGrid(width: number, height: number, count: number, gap = 6, aspect = 16 / 9) {
  let best = { cols: 1, tileWidth: 0, tileHeight: 0 };
  for (let cols = 1; cols <= Math.max(1, count); cols++) {
    const rows = Math.ceil(count / cols);
    const tileWidth = Math.min(
      (width - gap * (cols - 1)) / cols,
      ((height - gap * (rows - 1)) / rows) * aspect,
    );
    if (tileWidth > best.tileWidth) best = { cols, tileWidth, tileHeight: tileWidth / aspect };
  }
  return best;
}
