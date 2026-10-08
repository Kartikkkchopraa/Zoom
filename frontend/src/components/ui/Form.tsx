import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";

/** Zoom web-portal style form controls. */

const fieldBase =
  "h-8 w-full rounded-lg border border-[#c5c9d0] bg-white px-3 text-sm text-ink placeholder:text-ink-3 " +
  "focus:border-zoom-blue focus:outline-none focus:ring-2 focus:ring-zoom-blue/25 disabled:bg-shell disabled:text-ink-3";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(fieldBase, className)} {...props} />;
  },
);

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldBase, "h-auto min-h-20 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx("relative", className)}>
      <select className={clsx(fieldBase, "appearance-none pr-8")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-2" />
    </div>
  );
}

interface CheckProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  hint?: React.ReactNode;
}

export function Checkbox({ label, hint, className, ...props }: CheckProps) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-2.5 text-sm", props.disabled && "cursor-default", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-zoom-blue" {...props} />
      <span>
        <span className={props.disabled ? "text-ink-3" : "text-ink"}>{label}</span>
        {hint && <span className="mt-1 block text-ink-2">{hint}</span>}
      </span>
    </label>
  );
}

export function Radio({ label, className, ...props }: CheckProps) {
  return (
    <label className={clsx("flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="radio" className="size-4 shrink-0 accent-zoom-blue" {...props} />
      <span className="text-ink">{label}</span>
    </label>
  );
}

/** A label/content row of the Schedule Meeting form (label column on the left on desktop). */
export function FormRow({
  label,
  required,
  children,
  className,
}: {
  label?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("grid gap-2 py-3 md:grid-cols-[170px_1fr] md:gap-4", className)}>
      <div className="pt-1.5 text-sm text-ink">
        {required && <span className="mr-0.5 text-zoom-red">*</span>}
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
