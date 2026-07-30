import { Outlet } from "react-router-dom";

import ThemeToggle from "@/shared/components/layout/ThemeToggle/ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-slate-950">

      {/* Left Panel */}

      <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white p-14">

        <div>

          <h1 className="text-4xl font-bold tracking-tight">
            ChamaManager
          </h1>

          <p className="mt-4 text-blue-100 text-lg leading-8">
            Modern digital finance platform for Chamas,
            SACCOs and community investment groups.
          </p>

        </div>

        <div className="space-y-6">

          <Feature
            title="Secure Authentication"
            description="JWT authentication with enterprise-grade security."
          />

          <Feature
            title="M-Pesa Ready"
            description="Integrated contribution and payment processing."
          />

          <Feature
            title="Real Accounting"
            description="Built on double-entry bookkeeping principles."
          />

          <Feature
            title="Multi-Chama Workspace"
            description="Switch between organizations instantly."
          />

        </div>

        <div className="text-sm text-blue-100">
          © {new Date().getFullYear()} ChamaManager
        </div>

      </section>

      {/* Right Panel */}

      <section className="relative flex items-center justify-center p-8">

        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        {/*
          Works both as a route element (children is undefined, so the
          nested route renders through <Outlet />) and as a plain wrapper
          component (children is passed explicitly by a page).
        */}
        <div className="w-full max-w-md">
          {children ?? <Outlet />}
        </div>

      </section>

    </div>
  );
}

function Feature({ title, description }) {
  return (
    <div>
      <h3 className="font-semibold text-lg">
        {title}
      </h3>

      <p className="mt-1 text-blue-100">
        {description}
      </p>
    </div>
  );
}