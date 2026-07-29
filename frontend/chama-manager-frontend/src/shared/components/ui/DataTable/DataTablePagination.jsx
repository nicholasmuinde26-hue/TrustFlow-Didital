import Button from "../Button";

export default function DataTablePagination() {
  return (
    <div
      className="
      flex
      items-center
      justify-between
      border-t
      p-6
      "
    >
      <p className="text-sm text-slate-500">
        Showing 1–10 of 248
      </p>

      <div className="flex gap-2">

        <Button
          variant="secondary"
          size="sm"
        >
          Previous
        </Button>

        <Button
          variant="secondary"
          size="sm"
        >
          Next
        </Button>

      </div>

    </div>
  );
}