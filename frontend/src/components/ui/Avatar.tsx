import clsx from "clsx";

interface AvatarProps {
  name: string;
  initials?: string;
  color?: string;
  size?: number;
  /** "solid" = coloured tile (top bar, meeting room); "soft" = tinted tile (calendar cards). */
  variant?: "solid" | "soft";
  presence?: "available" | "in-meeting";
  className?: string;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  initials,
  color = "var(--color-avatar)",
  size = 32,
  variant = "solid",
  presence,
  className,
}: AvatarProps) {
  const text = initials ?? initialsOf(name);
  return (
    <span
      className={clsx("relative inline-flex shrink-0 select-none", className)}
      style={{ width: size, height: size }}
      title={name}
    >
      <span
        className="flex size-full items-center justify-center rounded-[25%] font-medium"
        style={
          variant === "solid"
            ? { background: color, color: "white", fontSize: size * 0.5 }
            : {
                background: `color-mix(in srgb, ${color} 18%, white)`,
                color,
                fontSize: size * 0.42,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, white)`,
              }
        }
      >
        {variant === "solid" ? text.slice(0, 1) : text}
      </span>
      {presence && (
        <span
          className={clsx(
            "absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white",
            presence === "available" ? "bg-green-500" : "bg-zoom-red",
          )}
        />
      )}
    </span>
  );
}
