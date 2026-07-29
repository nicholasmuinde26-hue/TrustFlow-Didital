import AuthLayout from "@/layouts/AuthLayout";

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start managing your Chama today"
    >
      <div className="space-y-4">
        <input
          placeholder="Full Name"
          className="w-full rounded-xl border p-3"
        />

        <input
          placeholder="Email"
          className="w-full rounded-xl border p-3"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-xl border p-3"
        />

        <button className="w-full rounded-xl bg-blue-600 p-3 text-white">
          Create Account
        </button>
      </div>
    </AuthLayout>
  );
}