import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const VIDEO_SRC = "/hero-3d.mp4";
const POSTER_SRC = "/hero-poster.jpg";

/**
 * Lazy-loaded, looping 3D hero video.
 *  - preload="none" + IntersectionObserver: the mp4 doesn't download until
 *    the frame nears the viewport, so it never blocks first paint / LCP
 *    (the lightweight poster paints instead).
 *  - Subtle scroll parallax (max 40px) on the frame via framer-motion.
 */
export default function HeroVideo({ className = "" }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, prefersReducedMotion ? 0 : 40]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoaded(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Attach src only once visible, then kick off playback.
  useEffect(() => {
    const v = videoRef.current;
    if (!loaded || !v || v.src) return;
    v.src = VIDEO_SRC;
    v.play().catch(() => {
      /* autoplay blocked — poster remains, no crash */
    });
  }, [loaded]);

  return (
    <motion.div ref={frameRef} style={{ y }} className={className}>
      <div className="grain relative overflow-hidden rounded-3xl border border-parchment bg-white p-2 shadow-[0_20px_60px_-20px_rgba(38,35,30,0.25)]">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={POSTER_SRC}
          aria-label="3D chess animation"
          className="aspect-video w-full rounded-2xl object-cover"
        />
        <div className="pointer-events-none absolute inset-2 rounded-2xl ring-1 ring-inset ring-ink/5" />
      </div>
    </motion.div>
  );
}
