export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const PALETTE = [
  "from-fuchsia-500 to-purple-700",
  "from-pink-500 to-rose-700",
  "from-violet-500 to-indigo-700",
  "from-cyan-500 to-blue-700",
  "from-amber-500 to-orange-700",
  "from-emerald-500 to-teal-700",
];

export function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
