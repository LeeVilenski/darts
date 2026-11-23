/**
 * Build a caller voice pack in public/voice/<pack>/.
 *
 *   node scripts/build-voice-pack.ts --list            # print key,text CSV (for recording your own voice)
 *   node scripts/build-voice-pack.ts --from-dir <dir>  # use your own recordings named <key>.mp3/.wav/.ogg
 *   TTS_API_KEY=... node scripts/build-voice-pack.ts   # generate every line with a TTS API
 *
 * TTS uses any OpenAI-compatible /audio/speech endpoint:
 *   TTS_BASE_URL (default https://api.openai.com/v1), TTS_MODEL (default gpt-4o-mini-tts),
 *   TTS_VOICE (default "onyx"), TTS_INSTRUCTIONS (delivery style), PACK (default "default").
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { voiceLines } from '../src/audio/voiceLines.ts';

const args = process.argv.slice(2);
const lines = voiceLines();
const pack = process.env.PACK ?? 'default';
const outDir = join('public', 'voice', pack);

if (args.includes('--list')) {
  console.log('key,text');
  for (const [k, t] of Object.entries(lines)) console.log(`${k},"${t}"`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const manifest: { name: string; lines: Record<string, string> } = { name: pack, lines: {} };

const fromDir = args[args.indexOf('--from-dir') + 1];
if (args.includes('--from-dir') && fromDir) {
  const files = new Map(readdirSync(fromDir).map((f) => [f.slice(0, -extname(f).length), f]));
  const missing: string[] = [];
  for (const key of Object.keys(lines)) {
    const f = files.get(key);
    if (!f) {
      missing.push(key);
      continue;
    }
    copyFileSync(join(fromDir, f), join(outDir, f));
    manifest.lines[key] = f;
  }
  if (missing.length)
    console.warn(
      `No recording for ${missing.length} lines (they will be silent): ${missing.slice(0, 8).join(', ')}…`,
    );
} else {
  const key = process.env.TTS_API_KEY;
  if (!key) {
    console.error(
      'Set TTS_API_KEY (or use --list / --from-dir). See the comment at the top of this file.',
    );
    process.exit(1);
  }
  const base = process.env.TTS_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.TTS_MODEL ?? 'gpt-4o-mini-tts';
  const voice = process.env.TTS_VOICE ?? 'onyx';
  const instructions =
    process.env.TTS_INSTRUCTIONS ??
    'You are a British professional darts referee calling scores in a packed arena: confident, clear, drawn-out on big scores.';
  for (const [k, text] of Object.entries(lines)) {
    const file = `${k}.mp3`;
    manifest.lines[k] = file;
    if (existsSync(join(outDir, file))) continue; // resumable
    const res = await fetch(`${base}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, voice, input: text, instructions, response_format: 'mp3' }),
    });
    if (!res.ok) {
      console.error(`Failed on ${k}: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
    process.stdout.write('.');
  }
  console.log();
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${Object.keys(manifest.lines).length} lines to ${outDir}`);
