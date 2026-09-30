import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  direction?: "up" | "down" | "left" | "right";
  once?: boolean;
}

export function ScrollReveal({ children, className, delay = 0, y = 64, direction = "up", once = true }: ScrollRevealProps) {
  const reducedMotion = useReducedMotion();
  const { ref, inView } = useInView({ triggerOnce: once, threshold: 0.05 });
  const offset = direction === "down" ? { x: 0, y: -y } : direction === "left" ? { x: y, y: 0 } : direction === "right" ? { x: -y, y: 0 } : { x: 0, y };
  const variants: Variants = {
    hidden: { opacity: 0, filter: "blur(12px)", ...offset },
    visible: { opacity: 1, filter: "blur(0px)", x: 0, y: 0 },
  };
  return <motion.div ref={ref} className={className} initial={reducedMotion ? false : "hidden"} animate={inView || reducedMotion ? "visible" : "hidden"} variants={variants} transition={{ duration: reducedMotion ? 0 : .8, delay: reducedMotion ? 0 : delay, ease: [.32, .72, 0, 1] }}>{children}</motion.div>;
}
