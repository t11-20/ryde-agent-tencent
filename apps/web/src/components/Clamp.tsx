import { useCallback, useEffect, useState } from 'react';

export interface ClampToggle {
  ref: (node: HTMLDivElement | null) => void;
  expanded: boolean;
  overflowing: boolean;
  showToggle: boolean;
  toggle: () => void;
}

/**
 * Shared clamp/expand logic: attach `ref` to a container holding `.clamp`
 * elements; `overflowing` is true while any clamped element's content is cut
 * off. The toggle stays visible while expanded. Pass a content key so the
 * overflow check re-runs when the clamped text changes.
 */
export function useClampToggle(contentKey?: unknown): ClampToggle {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const check = useCallback((): void => {
    if (element === null) return;
    const items = Array.from(element.querySelectorAll('.clamp'));
    let any = false;
    for (const item of items) {
      if (item.scrollHeight > item.clientHeight + 1) { any = true; break; }
    }
    setOverflowing(any);
  }, [element]);

  useEffect(() => {
    check();
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    for (const item of Array.from(element.querySelectorAll('.clamp'))) observer.observe(item);
    return () => { observer.disconnect(); };
  }, [element, check, expanded, contentKey]);

  const toggle = useCallback((): void => { setExpanded(value => !value); }, []);
  return {ref: setElement, expanded, overflowing, showToggle: expanded || overflowing, toggle};
}
