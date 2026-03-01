# Audio Hook Assets

Drop these files in this folder to enable ambient loop and SFX:

- `ambient-loop.wav`
- `sfx-click.wav`
- `sfx-turn.wav`
- `sfx-error.wav`

Current frontend hook:

- Loads these from `/assets/audio/*`
- Autoplays ambient when sound is enabled (browser interaction rules apply)
- Plays SFX on UI actions, turn changes, and realtime errors
