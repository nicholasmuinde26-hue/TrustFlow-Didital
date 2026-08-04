import { Link, useNavigate } from "react-router-dom";
import { Building2, Wallet, Plus, LogIn } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";

export default function HomePage() {
  const { user } = useAuth();
  const { workspaces, loading, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  function openWorkspace(workspace) {
    selectWorkspace(workspace);
    navigate(`/workspace/${workspace.id ?? workspace._id}`);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        Welcome{user?.name ? `, ${user.name}` : ""}
      </h1>

      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {loading
          ? "Loading your workspaces..."
          : workspaces.length > 0
          ? "You currently belong to:"
          : "You don't belong to any workspace yet."}
      </p>

      {loading ? (
        <div className="mt-10">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {workspaces.map((workspace) => {
            const id = workspace.id ?? workspace._id;

            return (
              <button
                key={id}
                onClick={() => openWorkspace(workspace)}
                className="
                  flex items-center gap-4 rounded-2xl border border-slate-200
                  bg-white p-5 text-left transition-all hover:-translate-y-0.5
                  hover:shadow-lg
                  dark:border-slate-800 dark:bg-slate-900
                "
              >
                <div className="rounded-xl bg-primary/10 p-3">
                  {workspace.type === "chama" ? (
                    <Building2 size={22} className="text-primary" />
                  ) : (
                    <Wallet size={22} className="text-primary" />
                  )}
                </div>

                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {workspace.name}
                  </p>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {workspace.role || (workspace.type === "chama" ? "Chama" : "Contribution Group")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <h2 className="mt-12 text-lg font-semibold text-slate-900 dark:text-white">
        Get Started
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          icon={Plus}
          title="Create Chama"
          to="/chamas/new"
        />

        <ActionCard
          icon={LogIn}
          title="Join Chama"
          to="/chamas/join"
        />

        <ActionCard
          icon={Plus}
          title="Create Contribution Group"
          to="/contribution-groups/new"
        />

        <ActionCard
          icon={LogIn}
          title="Join Contribution Group"
          to="/contribution-groups/join"
        />
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, to }) {
  return (
    <Link
      to={to}
      className="
        flex flex-col items-start gap-3 rounded-2xl border border-dashed
        border-slate-300 p-5 transition-colors hover:border-primary
        hover:bg-primary/5
        dark:border-slate-700
      "
    >
      <span className="rounded-xl bg-primary/10 p-3">
        <Icon size={20} className="text-primary" />
      </span>

      <span className="font-medium text-slate-900 dark:text-white">
        {title}
      </span>
    </Link>
  );
}