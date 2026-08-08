import {
    Sparkles,
    ArrowRight,
    Brain,
} from "lucide-react";

export default function WorkspaceAIWidget() {
    return (
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-700 p-6 text-white shadow-xl">

            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/20 p-3">
                    <Brain size={22} />
                </div>

                <div>
                    <h3 className="font-semibold">
                        Chama AI
                    </h3>

                    <p className="text-sm text-violet-100">
                        Financial Assistant
                    </p>
                </div>
            </div>

            <div className="mt-6 space-y-3 text-sm">

                <p>✅ 6 members contributed today.</p>

                <p>📈 Savings increased by KES 15,000.</p>

                <p>⚠ 2 members are overdue.</p>

            </div>

            <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">

                <p className="font-medium">
                    Recommendation
                </p>

                <p className="mt-2 text-sm text-violet-100">
                    Send reminders before tomorrow's contribution deadline.
                </p>

            </div>

            <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-violet-700 transition hover:bg-violet-50">

                Ask AI

                <ArrowRight size={18} />

            </button>

        </section>
    );
}