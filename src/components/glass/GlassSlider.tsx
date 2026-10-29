import { useId } from "react";

interface Props {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

export function GlassSlider({
  label,
  description,
  value,
  min,
  max,
  step = 0.05,
  onChange,
  format,
}: Props) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[14px]">
        <label htmlFor={id} className="text-fg">
          {label}
        </label>
        <span className="tabular text-[13px] text-fg-2">{format ? format(value) : value}</span>
      </div>
      {description && <p className="-mt-1 text-[12px] text-fg-3">{description}</p>}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        style={{
          background: `linear-gradient(90deg, #fff ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
        }}
      />
    </div>
  );
}
