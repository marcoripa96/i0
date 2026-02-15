"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const SIGNATURE_PATH =
  "M 8,42 C 6,28 6,10 12,10 C 18,10 16,30 20,28 C 24,26 22,10 28,10 C 34,10 32,42 36,42 C 40,42 38,20 46,20 C 52,20 50,36 46,36 C 42,36 48,42 54,34 C 58,28 56,18 62,18 C 66,18 64,24 62,26 C 66,16 74,16 78,22 C 82,28 78,38 74,36 C 70,34 78,42 84,30 C 88,22 86,16 92,16 C 98,16 98,38 92,36 C 88,34 96,44 118,34";

export function Signature() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { amount: 0.5 });

  return (
    <svg
      ref={ref}
      viewBox="0 0 125 50"
      className="h-5 w-auto"
      aria-label="Marco"
    >
      <motion.path
        d={SIGNATURE_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 800 }}
        initial={{ strokeDashoffset: 800, opacity: 0 }}
        animate={
          inView
            ? { strokeDashoffset: 0, opacity: 0.7 }
            : { strokeDashoffset: 800, opacity: 0 }
        }
        transition={{
          strokeDashoffset: { duration: 1.8, ease: [0.22, 0.61, 0.36, 1] },
          opacity: { duration: 0.2 },
        }}
      />
    </svg>
  );
}
