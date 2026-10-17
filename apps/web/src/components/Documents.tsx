import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiBlobUrl, apiUpload, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";

interface DocFile {
  id: number;
  mimeType: string;
  createdAt: string;
}

// Documents (for example a TOPIK certificate). Files are private: they are opened with the login token.
// Without `userId` it is "my documents" (upload and delete); with `userId` it is the read-only admin view.
export function Documents({ userId }: { userId?: number }) {
  const [files, setFiles] = useState<DocFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const readOnly = userId !== undefined;

  const load = useCallback(() => {
    api<{ files: DocFile[] }>("GET", readOnly ? `/admin/users/${userId}/files` : "/files")
      .then((data) => setFiles(data.files))
      .catch((e) => {
        setFiles([]);
        setError(errorMessage(e));
      });
  }, [readOnly, userId]);

  useEffect(load, [load]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpload("/files", file);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function open(file: DocFile) {
    setError(null);
    try {
      const url = await apiBlobUrl(`/files/${file.id}`);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(file: DocFile) {
    if (!window.confirm("Delete this document?")) return;
    try {
      await api("DELETE", `/files/${file.id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <div className="doc-list">
        {files === null && <div className="empty"><span className="spinner" /> Loading...</div>}
        {files !== null && files.length === 0 && <div className="empty">No documents yet</div>}
        {(files ?? []).map((file) => (
          <div className="doc-item" key={file.id}>
            <div className="grow">
              {file.mimeType === "application/pdf" ? "PDF document" : "Image"} #{file.id}
              <small>{formatDate(file.createdAt)}</small>
            </div>
            <button type="button" onClick={() => open(file)}>
              Open
            </button>
            {!readOnly && (
              <button type="button" style={{ color: "#c0392b" }} onClick={() => remove(file)}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            hidden
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button type="button" className="btn outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading..." : "Upload a document (JPG, PNG, PDF)"}
          </button>
        </>
      )}
    </div>
  );
}
