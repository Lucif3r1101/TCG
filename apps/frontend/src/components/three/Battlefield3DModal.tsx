import { Suspense, lazy } from "react";

// Lazy-load the entire Three.js scene so its ~600KB only downloads when the
// user actually opens the 3D arena, keeping the main bundle light for everyone.
const Battlefield3D = lazy(() => import("./Battlefield3D"));

type Battlefield3DModalProps = {
  open: boolean;
  onClose: () => void;
  enemySlugs?: string[];
  mySlugs?: string[];
};

export function Battlefield3DModal({ open, onClose, enemySlugs, mySlugs }: Battlefield3DModalProps) {
  if (!open) return null;
  return (
    <div className="three-overlay" role="dialog" aria-modal="true">
      <div className="three-bar">
        <span className="three-badge">3D Arena · Beta</span>
        <span className="three-hint">Drag to orbit · pinch/scroll to zoom</span>
        <button className="icon-close" type="button" onClick={onClose} aria-label="Close 3D arena">×</button>
      </div>
      <div className="three-canvas-wrap">
        <Suspense fallback={<div className="three-loading">Loading 3D arena…</div>}>
          <Battlefield3D enemySlugs={enemySlugs} mySlugs={mySlugs} />
        </Suspense>
      </div>
    </div>
  );
}
