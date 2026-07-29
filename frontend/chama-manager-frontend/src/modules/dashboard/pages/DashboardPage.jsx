import DashboardLayout from "@/layouts/DashboardLayout";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <h1 className="text-4xl font-bold">
        Dashboard
      </h1>

      <p className="mt-2 text-slate-500">
        Welcome to ChamaManager 🚀
      </p>
    </DashboardLayout>
  );
}