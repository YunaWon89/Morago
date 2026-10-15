import type { InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: string;
  error?: string | null;
}

export function Field({ label, icon, error, ...input }: FieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={error ? "input-wrap invalid" : "input-wrap"}>
        {icon && <Icon name={icon} size={18} />}
        <input {...input} />
      </div>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
