"use client";

import { useEffect, useRef, useState } from "react";

export interface StageScreen {
  key: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * The split stage: on wide screens the real product sits in the fixed left
 * half while the reading column scrolls, and the screen changes to match the
 * section in the middle of the view ([data-stage="<key>"] in the column).
 * Statements marked .step are lit as their screen shows. On phones the column
 * carries its own pictures and the stage is not shown.
 */
export function SplitStage({ screens, children }: { screens: StageScreen[]; children: React.ReactNode }) {
  const column = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(screens[0]?.key);

  useEffect(() => {
    const root = column.current;
    if (!root) return;
    let frame = 0;
    const pick = () => {
      frame = 0;
      const middle = window.innerHeight * 0.5;
      let best: HTMLElement | null = null;
      let bestDistance = Infinity;
      root.querySelectorAll<HTMLElement>("[data-stage]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = r.top <= middle && r.bottom >= middle ? 0 : Math.min(Math.abs(r.top - middle), Math.abs(r.bottom - middle));
        if (d < bestDistance) {
          bestDistance = d;
          best = el;
        }
      });
      root.querySelectorAll<HTMLElement>(".step").forEach((el) => el.classList.toggle("is-active", el === best));
      const key = (best as HTMLElement | null)?.dataset.stage;
      if (key) setActive(key);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[47fr_53fr]">
      <div className="hidden bg-[var(--lp-dark)] lg:block">
        <div className="sticky top-0 h-svh p-[var(--margin)]">
          {/* The product itself, never a mock-up: the screen for the section being read. */}
          <div className="stage h-full" data-ui aria-hidden={false}>
            {screens.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.key}
                src={s.src}
                alt={s.key === active ? s.alt : ""}
                width={s.width}
                height={s.height}
                loading={s.key === screens[0]?.key ? "eager" : "lazy"}
                decoding="async"
                className={s.key === active ? "is-active" : undefined}
              />
            ))}
          </div>
        </div>
      </div>
      <div ref={column} className="min-w-0">
        {children}
      </div>
    </div>
  );
}
