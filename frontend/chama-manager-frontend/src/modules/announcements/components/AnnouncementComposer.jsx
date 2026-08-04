import { useState } from "react";
import { Pin } from "lucide-react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";

export default function AnnouncementComposer({ onSubmit, submitting }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) return;

    await onSubmit({ title: title.trim(), content: content.trim(), pinned });

    setTitle("");
    setContent("");
    setPinned(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="font-semibold text-slate-900 dark:text-white">
        Post an Announcement
      </h3>

      <div className="mt-4 space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <textarea
          placeholder="What do members need to know?"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          required
          className="
            w-full resize-none rounded-xl border border-slate-200 bg-white
            px-4 py-3 text-sm text-slate-900 outline-none transition-colors
            focus:border-primary
            dark:border-slate-700 dark:bg-slate-800 dark:text-white
          "
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <Pin size={14} />
            Pin to top
          </label>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}