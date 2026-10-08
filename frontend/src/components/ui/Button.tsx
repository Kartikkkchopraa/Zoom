import clsx from "clsx";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-zoom-blue text-white hover:bg-zoom-blue-hover disabled:bg-zoom-blue/50",
  secondary: "border border-[#c5c9d0] bg-white text-ink hover:bg-shell disabled:text-ink-3",
  danger: "bg-zoom-red text-white hover:bg-[#c81f1f] disabled:bg-zoom-red/50",
  ghost: "text-zoom-blue hover:bg-zoom-blue-soft disabled:text-ink-3",
  soft: "bg-zoom-blue-soft text-zoom-blue hover:bg-[#d3ddef]",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-3 text-xs",
  md: "h-8 px-4 text-sm",
  lg: "h-10 px-5 text-[15px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
