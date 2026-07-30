import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import useAuth from "@/app/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import PasswordInput from "@/modules/auth/components/PasswordInput";
import Input from "@/shared/components/ui/Input/Input";
import Button from "@/shared/components/ui/Button";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { confirmPassword, ...payload } = form;

      await register(payload);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not create your account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <h2 className="text-2xl font-bold">
          Create Account
        </h2>

        <p className="mt-1 text-slate-500">
          Start managing your Chama today
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <Input
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Jane Wanjiru"
            autoComplete="name"
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="07XXXXXXXX"
            autoComplete="tel"
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Password
            </label>

            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Confirm Password
            </label>

            <PasswordInput
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting
              ? "Creating account..."
              : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-primary"
          >
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}