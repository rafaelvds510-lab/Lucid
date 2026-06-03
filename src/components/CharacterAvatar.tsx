import { initials, paletteFor } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
  xl: "h-28 w-28 text-3xl",
};

export function CharacterAvatar({ name, url, size = "md", className }: Props) {
  const cls = cn(
    "rounded-full flex items-center justify-center font-display font-semibold overflow-hidden ring-1 ring-border shadow-glow",
    SIZES[size],
    className
  );
  if (url) {
    return <img src={url} alt={name} className={cn(cls, "object-cover")} />;
  }
  return (
    <div className={cn(cls, "bg-gradient-to-br text-white", paletteFor(name))}>
      {initials(name)}
    </div>
  );
}
