import {
    UserPlus,
    CircleDollarSign,
    CalendarDays,
    Megaphone,
} from "lucide-react";

const activities = [
    {
        title: "John joined the workspace",
        time: "10 minutes ago",
        icon: UserPlus,
    },
    {
        title: "Mary contributed KES 2,000",
        time: "1 hour ago",
        icon: CircleDollarSign,
    },
    {
        title: "Meeting scheduled",
        time: "Yesterday",
        icon: CalendarDays,
    },
    {
        title: "Announcement published",
        time: "Yesterday",
        icon: Megaphone,
    },
];

export default function WorkspaceActivity() {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <h2 className="mb-6 text-lg font-semibold">
                Recent Activity
            </h2>

            <div className="space-y-5">

                {activities.map(activity => {

                    const Icon = activity.icon;

                    return (

                        <div
                            key={activity.title}
                            className="flex gap-4"
                        >

                            <div className="rounded-xl bg-violet-100 p-3 text-violet-700">

                                <Icon size={18}/>

                            </div>

                            <div>

                                <p className="font-medium">

                                    {activity.title}

                                </p>

                                <p className="text-sm text-slate-500">

                                    {activity.time}

                                </p>

                            </div>

                        </div>

                    );

                })}

            </div>

        </section>
    );
}