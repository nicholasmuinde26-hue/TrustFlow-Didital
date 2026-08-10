import { useState, useEffect } from "react";
import fileToDataUri from "@/utils/fileToDataUri";

const MAX_AVATAR_BYTES = 2_800_000; // matches backend approx limit
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function EditProfileModal({ open, onClose, initial = {}, onSave, saving }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    id_number: "",
    avatar_url: null,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial.name || "",
        phone: initial.phone || "",
        email: initial.email || "",
        id_number: initial.id_number || "",
        avatar_url: initial.avatar_url || null,
      });
      setAvatarFile(null);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleFile = async (ev) => {
    setError(null);
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PNG / JPEG / WEBP images are accepted.");
      return;
    }
    // quick size check (file.size is bytes)
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Avatar must be less than ~2.8MB.");
      return;
    }
    try {
      const dataUri = await fileToDataUri(file);
      // dataUri length check (conservative)
      if (dataUri && dataUri.length > MAX_AVATAR_BYTES * 1.5) {
        setError("Avatar too large after encoding. Use a smaller image.");
        return;
      }
      setAvatarFile(file);
      setForm((s) => ({ ...s, avatar_url: dataUri }));
    } catch (err) {
      setError("Failed to read image file.");
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);
    // simple client-side validation
    if (!form.name?.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      // onSave returns a promise
      await onSave({
        name: form.name.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        id_number: form.id_number?.trim() || null,
        avatar_url: form.avatar_url || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Save failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Edit profile</h2>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium">Avatar</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">No</div>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleFile} />
            </div>
            <p className="mt-1 text-xs text-slate-500">PNG / JPEG / WEBP — max ~2.8MB</p>
          </div>

          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              className="mt-1 block w-full rounded border px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Phone</label>
            <input
              className="mt-1 block w-full rounded border px-3 py-2"
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              className="mt-1 block w-full rounded border px-3 py-2"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">ID number</label>
            <input
              className="mt-1 block w-full rounded border px-3 py-2"
              value={form.id_number || ""}
              onChange={(e) => setForm({ ...form, id_number: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded px-4 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-primary px-4 py-2 text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}