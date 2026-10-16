import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiUpload, errorMessage } from "../lib/api";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

// The big picture with a camera button, as on the "Complete your profile" screen.
export function AvatarPicker({ size = 92 }: { size?: number }) {
  const { user, refreshUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpload("/files/avatar", file);
      await refreshUser();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="profile-avatar">
      <div className="avatar-picker">
        <Avatar fileId={user.avatarFileId} name={user.fullName} size={size} square />
        <button type="button" className="camera-badge" disabled={busy} onClick={() => input.current?.click()} aria-label="Change photo">
          <Icon name="camera" size={16} />
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void pick(event.target.files?.[0])} />
      </div>
      {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
