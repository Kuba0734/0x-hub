import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GlassInput, type GlassInputProps } from "@/components/glass/GlassInput";
import { strings } from "@/lib/strings";

/** Password field with a show/hide toggle. */
export function PasswordInput(props: Omit<GlassInputProps, "type" | "trailing">) {
  const [show, setShow] = useState(false);
  return (
    <GlassInput
      {...props}
      type={show ? "text" : "password"}
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? strings.common.hidePassword : strings.common.showPassword}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-3 hover:text-fg"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}
