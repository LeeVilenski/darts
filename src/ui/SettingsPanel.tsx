import type { BounceSetting } from '../engine/board/resolveHit';
import type { AssistLevel } from '../engine/physics/throwModel';
import { useGameStore, type CameraStyle } from '../store/useGameStore';
import { Segmented } from './Segmented';

export function SettingsPanel() {
  const assist = useGameStore((s) => s.assist);
  const bounce = useGameStore((s) => s.bounce);
  const camera = useGameStore((s) => s.camera);
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
    </div>
  );
}
