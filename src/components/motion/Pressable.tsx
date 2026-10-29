import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { pressScale, springSnappy } from "./presets";

/** A button with a spring press-scale. */
export const Pressable = forwardRef<HTMLButtonElement, HTMLMotionProps<"button">>(
  function Pressable({ whileTap, transition, type = "button", ...rest }, ref) {
    return (
      <motion.button
        ref={ref}
        type={type}
        whileTap={rest.disabled ? undefined : (whileTap ?? pressScale)}
        transition={transition ?? springSnappy}
        {...rest}
      />
    );
  },
);
