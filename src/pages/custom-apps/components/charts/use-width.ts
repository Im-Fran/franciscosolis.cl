import {useEffect, useRef, useState} from "react";

/**
 * The rendered width of a chart's box, followed as it changes.
 *
 * The charts draw in real pixels rather than in a stretched `viewBox`: scaling an SVG to its box
 * scales its text with it, and an axis label that is 9 px on a phone and 16 px on a wide screen is
 * an axis label nobody reads twice.
 */
export const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return {ref, width};
};
