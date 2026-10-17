import { useEffect, useRef } from "react";
import { setServerErrorHandler } from "../lib/api";
import { useToast } from "./Toast";

// Shows a toast when the server fails (5xx) or cannot be reached. The same text is not repeated within 6 seconds.
export function ApiErrorToasts() {
  const toast = useToast();
  const last = useRef({ text: "", at: 0 });

  useEffect(() => {
    setServerErrorHandler((text) => {
      const now = Date.now();
      if (last.current.text === text && now - last.current.at < 6000) return;
      last.current = { text, at: now };
      toast.error(text);
    });
    return () => setServerErrorHandler(null);
  }, [toast]);

  return null;
}
