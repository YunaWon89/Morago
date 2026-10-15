import { initials } from "../lib/format";

const COLORS = ["#c8102e", "#ec9610", "#00596f", "#38b000", "#6b4eff", "#1e262e"];

interface AvatarProps {
  name: string;
  size?: number;
  square?: boolean;
}

// There are no uploaded photos yet, so people are shown as coloured initials.
export function Avatar({ name, size = 44, square = false }: AvatarProps) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        borderRadius: square ? Math.round(size * 0.28) : "50%",
        background: COLORS[hash % COLORS.length],
      }}
    >
      {initials(name) || "?"}
    </div>
  );
}
