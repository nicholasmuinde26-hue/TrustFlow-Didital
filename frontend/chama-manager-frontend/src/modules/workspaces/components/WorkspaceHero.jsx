import { Link, useParams } from "react-router-dom";
import {
    UserPlus,
    CircleDollarSign,
    MessageCircle,
    Sparkles,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";

export default function WorkspaceHero() {
    const { workspaceId } = useParams();
    const { workspaces } = useWorkspace();

    const workspace = workspaces.find(
        (w) => (w._id ?? w.id) === workspaceId
    );

    const base = `/workspace/${workspaceId}`;

    return (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 p-8 text-white shadow-xl">

            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />

            <div className="relative">

                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-sm backdrop-blur">

                    <Sparkles size={16} />

                    Active Workspace

                </div>

                <h1 className="mt-5 text-4xl font-bold">

                    {workspace?.name || "Workspace"}

                </h1>

                <p className="mt-3 max-w-2xl text-violet-100">

                    Manage members, finances, meetings and communication
                    from one intelligent workspace.

                </p>

                <div className="mt-8 flex flex-wrap gap-4">

                    <HeroButton
                        to={`${base}/members`}
                        icon={UserPlus}
                        label="Invite Members"
                    />

                    <HeroButton
                        to={`${base}/contributions`}
                        icon={CircleDollarSign}
                        label="Record Contribution"
                    />

                    <HeroButton
                        to={`${base}/chat`}
                        icon={MessageCircle}
                        label="Open Chat"
                    />

                </div>

            </div>

        </section>
    );
}

function HeroButton({ to, icon: Icon, label }) {
    return (
        <Link
            to={to}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-violet-700 transition hover:scale-105 hover:shadow-xl"
        >
            <Icon size={18} />
            {label}
        </Link>
    );
}