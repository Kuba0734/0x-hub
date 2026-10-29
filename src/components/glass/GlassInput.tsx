import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/format";

const field =
  "w-full rounded-xl border border-stroke bg-white/[0.04] px-3.5 text-[14px] text-fg placeholder:text-fg-3 " +
  "transition-colors duration-150 hover:bg-white/[0.06] focus-visible:bg-white/[0.07] " +
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] " +
  "disabled:opacity-40";

interface FieldShellProps {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  hideLabel?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ label, hint, error, id, hideLabel, children, className }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className={cn("text-[13px] text-fg-2", hideLabel && "sr-only")}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p
          id={`${id}-msg`}
          role="alert"
          className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--danger)]"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-[12px] text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  label?: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export function GlassInput({
  label,
  hideLabel,
  hint,
  error,
  leading,
  trailing,
  className,
  wrapperClassName,
  id,
  ...rest
}: GlassInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      id={inputId}
      className={wrapperClassName}
    >
      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-3 text-fg-3 [&>svg]:h-4 [&>svg]:w-4">
            {leading}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          className={cn(
            field,
            "h-10",
            leading ? "pl-9" : null,
            trailing ? "pr-10" : null,
            className,
          )}
          {...rest}
        />
        {trailing && <span className="absolute right-1.5 flex items-center">{trailing}</span>}
      </div>
    </FieldShell>
  );
}

export interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  label?: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | null;
  wrapperClassName?: string;
}

export function GlassTextarea({
  label,
  hideLabel,
  hint,
  error,
  className,
  wrapperClassName,
  id,
  ...rest
}: GlassTextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      id={inputId}
      className={wrapperClassName}
    >
      <textarea
        id={inputId}
        className={cn(field, "min-h-24 resize-none py-2.5 leading-relaxed", className)}
        {...rest}
      />
    </FieldShell>
  );
}
