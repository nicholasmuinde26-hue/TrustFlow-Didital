import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export default function PasswordInput({
  ...props
}) {
  const [show, setShow] =
    useState(false);

  return (
    <div className="relative">

      <input
        type={show ? "text" : "password"}
        className="
          h-12
          w-full
          rounded-xl
          border
          px-4
          pr-12
        "
        {...props}
      />

      <button
        type="button"
        onClick={() => setShow(!show)}
        className="
          absolute
          right-4
          top-1/2
          -translate-y-1/2
        "
      >
        {show ? (
          <EyeOff size={18} />
        ) : (
          <Eye size={18} />
        )}
      </button>

    </div>
  );
}