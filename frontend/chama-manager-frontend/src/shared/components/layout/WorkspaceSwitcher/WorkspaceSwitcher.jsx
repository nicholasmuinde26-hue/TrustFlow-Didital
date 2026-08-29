import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Building2, Wallet, Plus, Store, Home } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaces, activeWorkspace, selectWorkspace } = useWorkspace();

  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  function handleSelect(workspace) {
    selectWorkspace(workspace);
    setOpen(false);
    navigate(`/workspace/${workspace.id}`);
  }

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex
          items-center
          gap-2.5
          rounded-xl
          border
          border-slate-200
          bg-white
          px-2.5
          py-1.5
          sm:px-4
          sm:py-2.5
          transition-all
          hover:bg-slate-50
          dark:border-slate-700
          dark:bg-slate-800
          dark:hover:bg-slate-700
          max-w-[200px]
          sm:max-w-xs
        "
      >
        {activeWorkspace.type === "chama" ? (
          <Building2 size={18} className="text-primary shrink-0" />
        ) : activeWorkspace.type === "business" ? (
          <Store size={18} className="text-primary shrink-0" />
        ) : (
          <Wallet size={18} className="text-primary shrink-0" />
        )}

        <div className="text-left min-w-0">
          <p className="text-[10px] text-slate-500 leading-none mb-0.5 hidden sm:block">Workspace</p>

          <p className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
            {activeWorkspace.name}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={`transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
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
            <p className="text-sm font-semibold">Switch Workspace</p>
          </div>

          <div className="max-h-72 overflow-y-auto py-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleSelect(workspace)}
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
                  <Building2 size={18} className="text-primary shrink-0" />
                ) : workspace.type === "business" ? (
                  <Store size={18} className="text-primary shrink-0" />
                ) : (
                  <Wallet size={18} className="text-primary shrink-0" />
                )}

                <span className="flex-1">{workspace.name}</span>

                {workspace.id === activeWorkspace.id && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 p-2 dark:border-slate-700 space-y-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate("/home");
              }}
              className="
                flex
                w-full
                items-center
                gap-2.5
                rounded-xl
                px-3
                py-2.5
                text-xs
                font-bold
                text-slate-700
                dark:text-slate-200
                transition-colors
                hover:bg-slate-100
                dark:hover:bg-slate-800
              "
            >
              <Home size={16} className="text-violet-600 dark:text-cyan-400" />
              Return to Home Page
            </button>

            <button
              onClick={() => {
                setOpen(false);
                navigate("/home");
              }}
              className="
                flex
                w-full
                items-center
                gap-2.5
                rounded-xl
                px-3
                py-2.5
                text-xs
                font-bold
                text-primary
                transition-colors
                hover:bg-primary/10
              "
            >
              <Plus size={16} />
              Create Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}