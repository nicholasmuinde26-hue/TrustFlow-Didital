import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  IdCard,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Loader2,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useUpdateProfile from "@/modules/auth/hooks/useUpdateProfile";
import { useTheme } from "@/app/providers/ThemeProvider";
import fileToDataUri from "@/utils/fileToDataUri";

const MAX_AVATAR_BYTES = 2_800_000; // matches backend limit
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const { theme, isDark, setTheme } = useTheme();
  const navigate = useNavigate();

  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    id_number: "",
    avatar_url: null,
  });

  const [avatarError, setAvatarError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Keep the form in sync whenever the authenticated user changes/loads.
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        email: user.email || "",
        id_number: user.id_number || "",
        avatar_url: user.avatar_url || null,
      });
    }
  }, [user]);

  const initials = (form.name || user?.phone || "Account")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (saved) setSaved(false);
  };

  const handleAvatarChange = async (e) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Only PNG, JPEG, or WEBP images are accepted.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Photo must be under ~2.8MB.");
      return;
    }

    try {
      const dataUri = await fileToDataUri(file);
      setForm((prev) => ({ ...prev, avatar_url: dataUri }));
      if (saved) setSaved(false);
    } catch {
      setAvatarError("Failed to read that image. Try a different file.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);

    if (!form.name?.trim()) {
      setSaveError("Name is required.");
      return;
    }

    try {
      await updateProfile.mutateAsync({
        name: form.name.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        id_number: form.id_number?.trim() || null,
        avatar_url: form.avatar_url || null,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(
        err?.response?.data?.message ||
          err?.message ||
          "Couldn't save your changes. Please try again."
      );
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Account Settings
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage your personal profile, preferences, and account security.
          </p>
        </div>

        {saved && (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 size={15} /> Changes saved
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================= PROFILE ================= */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <User size={20} className="text-primary" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Personal Information
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-semibold text-white">
                {form.avatar_url ? (
                  <img
                    src={form.avatar_url}
                    alt="Your avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials || <User size={22} />
                )}
              </div>

              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm hover:bg-slate-700 dark:border-slate-900"
                title="Change photo"
              >
                <Camera size={12} />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {form.name || "Add your name"}
              </p>
              <p className="text-xs text-slate-500">
                PNG, JPEG or WEBP — up to ~2.8MB
              </p>
              {avatarError && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle size={12} /> {avatarError}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <div className="relative">
                <User
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={form.name}
                  onChange={handleChange("name")}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <div className="relative">
                <Phone
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={handleChange("phone")}
                  placeholder="07XXXXXXXX or 2547XXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Changing your phone number requires re-verification via OTP.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                ID Number
              </label>
              <div className="relative">
                <IdCard
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={form.id_number}
                  onChange={handleChange("id_number")}
                  placeholder="National ID"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-900 outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {saveError && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={13} /> {saveError}
            </p>
          )}
        </div>

        {/* ================= APPEARANCE ================= */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            {isDark ? (
              <Moon size={20} className="text-primary" />
            ) : (
              <Sun size={20} className="text-primary" />
            )}
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Appearance
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Theme
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Choose how your dashboard looks on this device.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  theme === "light"
                    ? "bg-primary text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                <Sun size={13} /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  theme === "dark"
                    ? "bg-primary text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                <Moon size={13} /> Dark
              </button>
            </div>
          </div>
        </div>

        {/* ================= ACCOUNT STATUS ================= */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <ShieldCheck size={20} className="text-primary" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Account Status
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone verification
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {user?.phone || "No phone on file"}
              </p>
            </div>

            {user?.isPhoneVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ShieldCheck size={13} /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                <ShieldAlert size={13} /> Unverified
              </span>
            )}
          </div>
        </div>

        {/* ================= SAVE ================= */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={15} /> Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* ================= SIGN OUT ================= */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Sign out
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            You'll need your phone number and password to sign back in.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30"
        >
          {signingOut ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <LogOut size={15} />
          )}
          Sign Out
        </button>
      </div>
    </div>
  );
}
