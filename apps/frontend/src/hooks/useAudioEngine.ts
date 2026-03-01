import { useEffect, useRef } from "react";

type SfxKey = "click" | "turn" | "error";

export function useAudioEngine(enabled: boolean) {
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<Record<SfxKey, HTMLAudioElement | null>>({
    click: null,
    turn: null,
    error: null
  });

  useEffect(() => {
    ambientRef.current = new Audio("/assets/audio/ambient-loop.wav");
    ambientRef.current.loop = true;
    ambientRef.current.volume = 0.2;

    sfxRef.current = {
      click: new Audio("/assets/audio/sfx-click.wav"),
      turn: new Audio("/assets/audio/sfx-turn.wav"),
      error: new Audio("/assets/audio/sfx-error.wav")
    };
    sfxRef.current.click!.volume = 0.45;
    sfxRef.current.turn!.volume = 0.5;
    sfxRef.current.error!.volume = 0.55;

    return () => {
      ambientRef.current?.pause();
      ambientRef.current = null;
      sfxRef.current = { click: null, turn: null, error: null };
    };
  }, []);

  useEffect(() => {
    const ambient = ambientRef.current;
    if (!ambient) {
      return;
    }

    if (enabled) {
      void ambient.play().catch(() => undefined);
    } else {
      ambient.pause();
      ambient.currentTime = 0;
    }
  }, [enabled]);

  function playSfx(key: SfxKey) {
    if (!enabled) {
      return;
    }

    const sound = sfxRef.current[key];
    if (!sound) {
      return;
    }

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }

  return { playSfx };
}
