import type { BounceSetting } from '../engine/board/resolveHit';
import type { AssistLevel } from '../engine/physics/throwModel';
import { useGameStore, type CameraStyle, type Quality } from '../store/useGameStore';
import { Segmented } from './Segmented';

export function SettingsPanel() {
  const assist = useGameStore((s) => s.assist);
  const bounce = useGameStore((s) => s.bounce);
  const camera = useGameStore((s) => s.camera);
  const sound = useGameStore((s) => s.sound);
  const caller = useGameStore((s) => s.caller);
  const ambience = useGameStore((s) => s.ambience);
  const replays = useGameStore((s) => s.replays);
  const quality = useGameStore((s) => s.quality);
  const onOff = [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ] as const;
  const update = useGameStore((s) => s.updateSettings);
  return (
    <div className="settings-panel">
      <Segmented<AssistLevel>
        label="Aim assist"
        value={assist}
        options={[
          { value: 'casual', label: 'Casual' },
          { value: 'standard', label: 'Standard' },
          { value: 'pro', label: 'Pro' },
        ]}
        onChange={(v) => update({ assist: v })}
      />
      <Segmented<BounceSetting>
        label="Bounce-outs"
        value={bounce}
        options={[
          { value: 'realistic', label: 'Realistic' },
          { value: 'low', label: 'Low' },
          { value: 'off', label: 'Off' },
        ]}
        onChange={(v) => update({ bounce: v })}
      />
      <Segmented<CameraStyle>
        label="Camera"
        value={camera}
        options={[
          { value: 'cinematic', label: 'Cinematic' },
          { value: 'reduced', label: 'Reduced motion' },
        ]}
        onChange={(v) => update({ camera: v })}
      />
      {camera !== 'reduced' && (
        <Segmented<boolean>
          label="Slow-motion replays"
          value={replays}
          options={onOff}
          onChange={(v) => update({ replays: v })}
        />
      )}
      <Segmented<Quality>
        label="Graphics"
        value={quality}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Battery saver' },
        ]}
        onChange={(v) => update({ quality: v })}
      />
      <Segmented<boolean>
        label="Sound"
        value={sound}
        options={onOff}
        onChange={(v) => update({ sound: v })}
      />
      {sound && (
        <>
          <Segmented<boolean>
            label="Caller"
            value={caller}
            options={onOff}
            onChange={(v) => update({ caller: v })}
          />
          <Segmented<boolean>
            label="Pub ambience"
            value={ambience}
            options={onOff}
            onChange={(v) => update({ ambience: v })}
          />
        </>
      )}
    </div>
  );
}
