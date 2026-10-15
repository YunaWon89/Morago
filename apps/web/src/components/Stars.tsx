interface StarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

export function Stars({ value, onChange, size = 14 }: StarsProps) {
  return (
    <span className="stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <span className={filled ? "star filled" : "star"}>{"\u2605"}</span>
        );
        return onChange ? (
          <button key={n} type="button" className="star-button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}
