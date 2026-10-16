import {useEffect, useRef} from "react";

/**
 * Calls `refresh` every `ms` while the tab is visible, and once more the moment it becomes visible
 * again.
 *
 * Telemetry is the reason this panel polls where the other consoles do not: "is it connected" is
 * the question somebody opens the screen to answer, and an answer that was true when the page
 * loaded is not one. A hidden tab is skipped rather than throttled, because nobody is reading it and
 * every poll is a database read on the service.
 */
export const useAutoRefresh = (refresh: () => void, ms: number, enabled = true) => {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const timer = window.setInterval(tick, ms);

    const onVisibility = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
};
