import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import useAuth from "@/app/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login(form);

      const redirectTo = location.state?.from?.pathname || "/home";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message || "Invalid phone number or password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <h2 className="text-2xl font-bold">Welcome Back</h2>

        <p className="mt-1 text-slate-500">
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Phone"
            type="tel"
            name="phone"
            value={form.phone }
            onChange={handleChange}
            placeholder="079297XXXX"
            autoComplete="tel"
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>

            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-primary">
            Create one
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}