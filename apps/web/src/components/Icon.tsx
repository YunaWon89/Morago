const PATHS: Record<string, string[]> = {
  home: ["M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  ],
  message: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "M21 21l-4.3-4.3"],
  back: ["M15 18l-6-6 6-6"],
  chevron: ["M9 18l6-6-6-6"],
  plus: ["M12 5v14", "M5 12h14"],
  check: ["M20 6L9 17l-5-5"],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  mic: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"],
  micOff: ["M2 2l20 20", "M9 9v3a3 3 0 0 0 5.1 2.1", "M15 9.3V5a3 3 0 0 0-5.9-.7", "M19 10v2a7 7 0 0 1-1.1 3.8", "M5 10v2a7 7 0 0 0 11 5.7", "M12 19v3"],
  camera: ["M23 7l-7 5 7 5z", "M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"],
  cameraOff: ["M2 2l20 20", "M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.7 0H14a2 2 0 0 1 2 2v3.3l1 1L23 7v10"],
  hangup: [
    "M10.7 13.3a16 16 0 0 0 2.6 2.1l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2C8.6 21 3 15.4 3 8.2A2 2 0 0 1 5 6h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1",
  ],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  copy: ["M9 9h11v11H9z", "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M12 16v-4", "M12 8h.01"],
};

interface IconProps {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 22, className }: IconProps) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
