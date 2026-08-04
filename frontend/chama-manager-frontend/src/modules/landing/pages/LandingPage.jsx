import { Link } from "react-router-dom";
import {
  Building2,
  Wallet,
  ShieldCheck,
  Users,
} from "lucide-react";

import Button from "@/shared/components/ui/Button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Top bar */}

      <header
        className="
        sticky top-0 z-30 flex h-20 items-center justify-between
        border-b border-slate-200 bg-white/80 px-6 backdrop-blur-xl
        dark:border-slate-800 dark:bg-slate-900/80
        lg:px-12
        "
      >
        <span className="text-xl font-bold text-slate-900 dark:text-white">
          ChamaManager
        </span>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>

          <Link to="/register">
            <Button>Create Account</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-5xl">
          One login. Every Chama and
          contribution group you belong to.
        </h1>

        <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
          ChamaManager keeps your identity separate from your
          workspaces — join or run as many Chamas and contribution
          groups as you like, all from a single account.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link to="/register">
            <Button className="px-8 py-3 text-base">
              Get Started
            </Button>
          </Link>

          <Link to="/login">
            <Button variant="secondary" className="px-8 py-3 text-base">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature grid */}

      <section className="mx-auto max-w-5xl grid gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        <Feature
          icon={Building2}
          title="Chama Workspaces"
          description="Members, contributions, loans and reports in one place."
        />

        <Feature
          icon={Wallet}
          title="Contribution Groups"
          description="Run a wedding, harambee or event fund collaboratively."
        />

        <Feature
          icon={Users}
          title="One Account, Many Groups"
          description="Switch between every workspace you belong to instantly."
        />

        <Feature
          icon={ShieldCheck}
          title="Records, Not Custody"
          description="We track the ledger — your money stays in your group's own till or account."
        />
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} ChamaManager
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="inline-flex rounded-xl bg-primary/10 p-3">
        <Icon size={22} className="text-primary" />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}