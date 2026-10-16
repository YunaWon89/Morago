import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Kind = "ok" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Short messages in the top corner ("Saved", "Copied", errors). They disappear on their own.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((kind: Kind, text: string) => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), kind === "error" ? 5000 : 3000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push("ok", text),
      error: (text) => push("error", text),
      info: (text) => push("info", text),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {items.map((item) => (
            <div key={item.id} className={`toast ${item.kind}`} role="status">
              <span className="toast-dot" />
              {item.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
