import { useRef } from "react";

interface OtpProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

// Boxes for the SMS code: typing moves to the next box, backspace to the previous one,
// and a pasted code fills all boxes at once.
export function Otp({ value, onChange, length = 6 }: OtpProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").split("");

  function setAt(index: number, text: string) {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = value.split("");
    for (let i = 0; i < clean.length && index + i < length; i += 1) next[index + i] = clean[i]!;
    onChange(next.join("").slice(0, length));
    refs.current[Math.min(index + clean.length, length - 1)]?.focus();
  }

  return (
    <div className="otp">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={digit.trim()}
          autoFocus={index === 0}
          onChange={(event) => setAt(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              const next = value.split("");
              const target = digit.trim() ? index : Math.max(index - 1, 0);
              next[target] = "";
              onChange(next.join("").replace(/\s/g, ""));
              refs.current[target]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
