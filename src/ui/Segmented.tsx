export interface SegmentedOption<T> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number | boolean>(props: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange(v: T): void;
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <div className="segmented" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? 'on' : ''}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
