import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./RollingNumber.css";

/**
 * How a RollingNumber rolls in. Every digit scrolls up through the `steps`
 * digits before it and lands on its own (with steps 5: 85 rolls 3→8 and
 * 0→5), like an odometer — enough movement to draw the eye and show the
 * number is live, without counting up from zero.
 */
export type RollingNumberMotion = {
  /** Digits each column scrolls through before landing. */
  steps: number;
  /** How long each column takes, in ms. */
  duration: number;
  /** Extra delay per column from the left, in ms, so they land one after another. */
  stagger: number;
  /** Delay before the first column starts, in ms. */
  delay: number;
  easing: string;
};

export const ROLLING_NUMBER_MOTION: RollingNumberMotion = {
  steps: 5,
  duration: 900,
  stagger: 90,
  delay: 120,
  // Fast start, long gentle settle.
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

/** Whether RollingNumbers inside should roll. Rolls by default. */
const RollingAnimate = createContext(true);

/** Scopes that have already rolled this session (see RollOnce). */
const rolledScopes = new Set<string>();

/**
 * Lets the numbers inside roll only the first time this scope is shown in
 * the session — e.g. a page: they roll on the first visit, not when you come
 * back. Remount it (key it by scope) for each new scope.
 */
export function RollOnce({ scope, children }: { scope: string; children: ReactNode }) {
  const [animate] = useState(() => !rolledScopes.has(scope));
  useEffect(() => {
    rolledScopes.add(scope);
  }, [scope]);
  return <RollingAnimate.Provider value={animate}>{children}</RollingAnimate.Provider>;
}

/** Numbers inside always roll when they appear, even inside a RollOnce that has already rolled (popovers, drawers). */
export function RollAlways({ children }: { children: ReactNode }) {
  return <RollingAnimate.Provider value>{children}</RollingAnimate.Provider>;
}

/**
 * A number whose digits roll into place when it first appears, and again
 * whenever the value changes — unless a RollOnce around it has already rolled. Anything that isn't a digit ("%", ".", "−")
 * stays still. Screen readers get the plain value; people who prefer reduced
 * motion get it without the roll.
 */
export function RollingNumber({
  value,
  motion,
  className,
}: {
  value: number | string;
  /** Override any part of ROLLING_NUMBER_MOTION. */
  motion?: Partial<RollingNumberMotion>;
  className?: string;
}) {
  const { steps, duration, stagger, delay, easing } = { ...ROLLING_NUMBER_MOTION, ...motion };
  const text = String(value);
  const ref = useRef<HTMLSpanElement | null>(null);
  const animate = useContext(RollingAnimate);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!animate || !root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const strips = [...root.querySelectorAll<HTMLElement>(".kb2Rolling__strip")];
    const animations = strips.map((strip, index) =>
      // Each strip rests showing its last digit (see CSS); start it scrolled
      // back to its first and let it run down to rest.
      strip.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-(steps / (steps + 1)) * 100}%)` }], {
        duration,
        delay: delay + index * stagger,
        easing,
        fill: "backwards",
      }),
    );
    return () => animations.forEach((a) => a.cancel());
  }, [animate, text, steps, duration, stagger, delay, easing]);

  return (
    <span ref={ref} className={className ? `kb2Rolling ${className}` : "kb2Rolling"}>
      <span className="kb2Rolling__sr">{text}</span>
      <span className="kb2Rolling__digits" aria-hidden>
        {[...text].map((char, index) => {
          if (!/\d/.test(char)) return <span key={index}>{char}</span>;
          const digit = Number(char);
          // The digits it rolls through, ending on its own: 3 4 5 6 7 8.
          const sequence = Array.from({ length: steps + 1 }, (_, i) => (digit - steps + i + 10) % 10);
          return (
            <span key={index} className="kb2Rolling__window">
              <span
                className="kb2Rolling__strip"
                style={{ transform: `translateY(${-(steps / (steps + 1)) * 100}%)` }}
              >
                {sequence.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
