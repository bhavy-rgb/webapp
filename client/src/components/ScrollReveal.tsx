import { motion, type Variants } from "framer-motion";
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

export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 32,
  direction = "up",
  once = true,
}: ScrollRevealProps) {
  const { ref, inView } = useInView({ triggerOnce: once, threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

  const offset =
    direction === "down"
      ? { x: 0, y: -y }
      : direction === "left"
        ? { x: y, y: 0 }
        : direction === "right"
          ? { x: -y, y: 0 }
          : { x: 0, y };

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    visible: { opacity: 1, x: 0, y: 0 },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
