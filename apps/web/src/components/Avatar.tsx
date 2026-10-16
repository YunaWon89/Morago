import { apiUrl } from "../lib/config";

const PALETTES: [string, string][] = [
  ["#e0394d", "#a31d2f"],
  ["#f2a73b", "#cf7a0a"],
  ["#1e8fab", "#00596f"],
  ["#53c21b", "#2d8a00"],
  ["#7b61ff", "#4b34c9"],
  ["#4a5a69", "#1e262e"],
];

interface AvatarProps {
  name: string;
  size?: number;
  square?: boolean;
  fileId?: number | null;
}

// A person with an uploaded photo shows it; everyone else gets a coloured portrait placeholder.
export function Avatar({ name, size = 44, square = false, fileId }: AvatarProps) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [from, to] = PALETTES[hash % PALETTES.length]!;
  const gradientId = `av${hash}`;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        borderRadius: square ? Math.round(size * 0.3) : "50%",
        background: `linear-gradient(160deg, ${from}, ${to})`,
      }}
      title={name}
    >
      {fileId ? <img src={apiUrl(`/api/files/${fileId}`)} alt={name} className="avatar-img" /> : null}
      <svg viewBox="0 0 100 100" aria-hidden="true" style={fileId ? { display: "none" } : undefined}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="38" r="17" fill={`url(#${gradientId})`} />
        <path d="M14 100c0-22 15-36 36-36s36 14 36 36z" fill={`url(#${gradientId})`} />
      </svg>
    </div>
  );
}
