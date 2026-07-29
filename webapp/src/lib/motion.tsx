import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/**
 * The framer-motion build installed here ships incomplete type declarations
 * (animation props like `whileInView`, `variants` are missing from
 * HTMLMotionProps). These thin wrappers restore a clean, typed surface for
 * the props we actually use so call sites stay tidy and type-safe.
 */
export interface MotionTagProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  whileInView?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  variants?: unknown;
  transition?: unknown;
  viewport?: unknown;
  custom?: unknown;
  onClick?: () => void;
  "aria-hidden"?: boolean;
  // Allow SVG presentation attributes (d, fill, stroke, cx, …) and other props.
  [key: string]: unknown;
}

type MotionTag = (props: MotionTagProps) => JSX.Element;

export const MDiv = motion.div as unknown as MotionTag;
export const MSpan = motion.span as unknown as MotionTag;
export const MPath = motion.path as unknown as MotionTag;
export const MLi = motion.li as unknown as MotionTag;
