import { useCallback, useEffect, useRef } from "react";

type SfxKey = "click" | "turn" | "error" | "draw" | "play";

export function useAudioEngine(enabled: boolean) {
  const sfxRef = useRef<Record<SfxKey, HTMLAudioElement | null>>({
    click: null,
    turn: null,
    error: null,
    draw: null,
    play: null
  });

  useEffect(() => {
    // No looping ambient track — the continuous drone pinned the CPU and hummed.
    sfxRef.current = {
      click: new Audio("/assets/audio/sfx-click.wav"),
      turn: new Audio("/assets/audio/sfx-turn.wav"),
      error: new Audio("/assets/audio/sfx-error.wav"),
      draw: new Audio("/assets/audio/sfx-click.wav"),
      play: new Audio("/assets/audio/sfx-turn.wav")
    };
    sfxRef.current.click!.volume = 0.45;
    sfxRef.current.turn!.volume = 0.5;
    sfxRef.current.error!.volume = 0.55;
    sfxRef.current.draw!.volume = 0.35;
    sfxRef.current.play!.volume = 0.45;

    return () => {
      sfxRef.current = { click: null, turn: null, error: null, draw: null, play: null };
    };
  }, []);

  const playSfx = useCallback((key: SfxKey) => {
    if (!enabled) {
      return;
    }

    const sound = sfxRef.current[key];
    if (!sound) {
      return;
    }

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, [enabled]);

  return { playSfx };
}
