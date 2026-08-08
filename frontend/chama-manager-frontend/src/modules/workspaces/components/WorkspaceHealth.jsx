import { ShieldCheck } from "lucide-react";

export default function WorkspaceHealth() {
    return (
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-green-700 p-6 text-white shadow-xl">

            <div className="flex items-center gap-3">

                <div className="rounded-xl bg-white/20 p-3">

                    <ShieldCheck size={22}/>

                </div>

                <div>

                    <h2 className="font-semibold">

                        Workspace Health

                    </h2>

                    <p className="text-sm text-green-100">

                        Overall performance

                    </p>

                </div>

            </div>

            <div className="mt-8">

                <div className="flex justify-between">

                    <span>Health Score</span>

                    <span className="font-bold">

                        91%

                    </span>

                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/20">

                    <div className="h-full w-[91%] rounded-full bg-white"/>

                </div>

            </div>

            <div className="mt-8 space-y-3 text-sm">

                <div className="flex justify-between">

                    <span>Contribution Rate</span>

                    <span>88%</span>

                </div>

                <div className="flex justify-between">

                    <span>Meeting Attendance</span>

                    <span>93%</span>

                </div>

                <div className="flex justify-between">

                    <span>Member Engagement</span>

                    <span>90%</span>

                </div>

            </div>

        </section>
    );
}