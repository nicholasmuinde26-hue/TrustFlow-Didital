import { ChevronDown, Building2, Wallet, Plus } from "lucide-react";
import { useState } from "react";

const workspaces = [
  {
    id: 1,
    name: "ABC Investment Chama",
    type: "chama",
  },
  {
    id: 2,
    name: "Monthly Savings",
    type: "group",
  },
  {
    id: 3,
    name: "Vacation Fund",
    type: "group",
  },
  {
    id: 4,
    name: "Building Project",
    type: "group",
  },
];

export default function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);

  const selectWorkspace = (workspace) => {
    setActiveWorkspace(workspace);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex
          items-center
          gap-3
          rounded-xl
          border
          border-slate-200
          bg-white
          px-4
          py-2.5
          transition-all
          hover:bg-slate-50
          dark:border-slate-700
          dark:bg-slate-800
          dark:hover:bg-slate-700
        "
      >
        {activeWorkspace.type === "chama" ? (
          <Building2
            size={18}
            className="text-primary"
          />
        ) : (
          <Wallet
            size={18}
            className="text-primary"
          />
        )}

        <div className="text-left">
          <p className="text-xs text-slate-500">
            Workspace
          </p>

          <p className="font-medium text-slate-900 dark:text-white">
            {activeWorkspace.name}
          </p>
        </div>

        <ChevronDown
          size={18}
          className={`transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="
            absolute
            left-0
            mt-3
            w-80
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-xl
            dark:border-slate-700
            dark:bg-slate-900
            z-50
          "
        >
          <div className="border-b border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-semibold">
              Switch Workspace
            </p>
          </div>

          <div className="py-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => selectWorkspace(workspace)}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  px-4
                  py-3
                  text-left
                  transition-colors
                  hover:bg-slate-100
                  dark:hover:bg-slate-800
                "
              >
                {workspace.type === "chama" ? (
                  <Building2
                    size={18}
                    className="text-primary"
                  />
                ) : (
                  <Wallet
                    size={18}
                    className="text-primary"
                  />
                )}

                <span className="flex-1">
                  {workspace.name}
                </span>

                {workspace.id === activeWorkspace.id && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 p-2 dark:border-slate-700">
            <button
              className="
                flex
                w-full
                items-center
                gap-2
                rounded-xl
                px-3
                py-3
                text-primary
                transition-colors
                hover:bg-primary/10
              "
            >
              <Plus size={18} />

              Create Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}