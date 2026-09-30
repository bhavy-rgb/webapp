import { useLayoutEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Check, Robot } from "@phosphor-icons/react";

/** A genuine opening position, displayed without game controls. */
export default function BoardPreview({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const update = () => setWidth(ref.current?.clientWidth ?? 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div className={`board-preview ${compact ? "board-preview-compact" : ""}`}>
    <div className="preview-player"><span className="preview-icon"><Robot size={20} /></span><div><strong>Chessify bot</strong><span>A little challenge. No pressure.</span></div><span className="preview-badge">Casual</span></div>
    <div ref={ref} className="preview-board" role="img" aria-label="Chess opening after e4, e5, and knight to f3. Black to move.">
      {width > 0 ? <div aria-hidden="true"><Chessboard id={compact ? "auth-preview" : "home-preview"} boardWidth={width} position="rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" arePiecesDraggable={false} areArrowsAllowed={false} customDarkSquareStyle={{ backgroundColor: "#899b73" }} customLightSquareStyle={{ backgroundColor: "#eeefe5" }} customSquareStyles={{ g1: { backgroundColor: "#d6df91" }, f3: { backgroundColor: "#d6df91" } }} customBoardStyle={{ borderRadius: "8px", overflow: "hidden" }} /></div> : <div className="aspect-square skeleton-block" />}
    </div>
    <div className="preview-caption"><span><span className="status-dot" /> One move at a time.</span><Check size={18} /></div>
  </div>;
}
