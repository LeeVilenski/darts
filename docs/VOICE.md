# Caller voice packs

The caller says turn totals ("one hundred and eighty!"), "no score", "game shot" and
"you require …" in x01, and "game shot" in every mode. Without a pack it uses the
browser's built-in speech, so it works out of the box but sounds robotic.

A pack is a folder `public/voice/<name>/` with one audio file per line and a
`manifest.json` mapping line keys to files. The game loads `public/voice/default/`.

## Generate a pack with text-to-speech

Any OpenAI-compatible `/audio/speech` endpoint works:

```bash
TTS_API_KEY=sk-... pnpm voice:build
# optional: TTS_BASE_URL, TTS_MODEL (gpt-4o-mini-tts), TTS_VOICE (onyx), TTS_INSTRUCTIONS
```

It writes ~356 short MP3s (about 2 MB total, loaded on demand), and is resumable.
Commit `public/voice/default/` and deploy.

## Record your own voice

1. `pnpm voice:list > lines.csv` lists every key and what to say.
2. Record each line and name the file after its key, e.g. `score_180.wav`, `game_shot.mp3`.
3. `node scripts/build-voice-pack.ts --from-dir path/to/recordings` copies them into the
   pack and writes the manifest. Missing lines are simply skipped (silent).
