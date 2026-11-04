"use client";

import { useEffect } from "react";

/**
 * Marks each [data-reveal] element on the landing page as it scrolls into
 * view, so its parts rise in one after another (app/landing.css). Renders
 * nothing; without it (no script) the CSS leaves everything visible.
 */
export function Reveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".lp [data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
