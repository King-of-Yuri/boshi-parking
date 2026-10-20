import { cn } from "@/lib/utils";
import type { PlateColor } from "@/lib/parking";

function formatPlate(plate: string): string {
  if (plate.length < 2) return plate;
  return `${plate.slice(0, 2)}·${plate.slice(2)}`;
}

export function PlateBadge({
  plate,
  color = "blue",
  size = "md",
  className,
}: {
  plate: string;
  color?: PlateColor;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "plate-face inline-flex items-center justify-center rounded-sm",
        color === "green" && "plate-green",
        color === "yellow" && "plate-yellow",
        color === "white" && "plate-white",
        color === "black" && "plate-black",
        color === "blue" && "plate-blue",
        size === "sm" && "h-7 min-w-[7.5rem] px-2 text-xs",
        size === "md" && "h-9 min-w-[9.5rem] px-2.5 text-sm",
        size === "lg" && "h-14 min-w-[16rem] px-4 text-2xl tracking-[0.18em]",
        className,
      )}
    >
      {formatPlate(plate)}
    </span>
  );
}
