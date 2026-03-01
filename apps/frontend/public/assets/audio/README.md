# Audio Hook Assets

Drop these files in this folder to enable ambient loop and SFX:

- `ambient-loop.mp3`
- `sfx-click.mp3`
- `sfx-turn.mp3`
- `sfx-error.mp3`

Current frontend hook:

- Loads these from `/assets/audio/*`
- Autoplays ambient when sound is enabled (browser interaction rules apply)
- Plays SFX on UI actions, turn changes, and realtime errors
