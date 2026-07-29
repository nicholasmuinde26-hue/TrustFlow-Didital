import AuthLayout from "@/layouts/AuthLayout";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to continue"
    >
      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-xl border p-3"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-xl border p-3"
        />

        <button className="w-full rounded-xl bg-blue-600 p-3 text-white">
          Sign In
        </button>
      </div>
    </AuthLayout>
  );
}