import { Database } from "lucide-react";

export default function DataTableEmpty({
  columns,
}) {
  return (
    <tr>

      <td
        colSpan={columns}
        className="py-16"
      >
        <div
          className="
          flex
          flex-col
          items-center
          justify-center
          gap-4
          "
        >
          <Database
            size={42}
            className="text-slate-400"
          />

          <h3 className="font-semibold">
            No data found
          </h3>

          <p className="text-slate-500">
            Once records exist they'll appear here.
          </p>

        </div>

      </td>

    </tr>
  );
}