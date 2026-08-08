import { ShieldCheck } from "lucide-react";

export default function Logo() {
  return (
    <div className="flex items-center gap-3">

      <div
        className="
        h-11
        w-11
        rounded-xl
        bg-blue-600
        text-white
        flex
        items-center
        justify-center
        "
      >
        <ShieldCheck size={22} />
      </div>

      <div>

        <h2 className="font-black text-lg">
          VeriCircle
        </h2>

        <p className="text-xs text-slate-500">
          Trust • Connect • Grow
        </p>

      </div>

    </div>
  );
}