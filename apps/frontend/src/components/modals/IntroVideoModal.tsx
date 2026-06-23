import { useEffect, useRef, useState } from "react";

type IntroVideoModalProps = {
  open: boolean;
  onClose: () => void;
};

// Path to the launch trailer (served from public/). Drop the file here:
// apps/frontend/public/assets/branding/intro.mp4
const INTRO_SRC = "/assets/branding/intro.mp4";

export function IntroVideoModal({ open, onClose }: IntroVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(false);

  // Try to autoplay with sound; if the browser blocks it (most do), fall back
  // to a muted autoplay and surface a "tap for sound" button.
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    setMuted(false);
    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      video.play().catch(() => {
        /* user can still press the native controls */
      });
    });
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const enableSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    void video.play();
  };

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-label="Intro trailer" onClick={onClose}>
      <div className="intro-stage" onClick={(e) => e.stopPropagation()}>
        <button className="intro-close" type="button" onClick={onClose} aria-label="Skip intro">Skip ⏭</button>
        <video
          ref={videoRef}
          className="intro-video"
          src={INTRO_SRC}
          playsInline
          autoPlay
          onEnded={onClose}
        />
        {muted ? (
          <button className="intro-unmute" type="button" onClick={enableSound}>
            🔊 Tap for sound
          </button>
        ) : null}
      </div>
    </div>
  );
}
