import {
    CalendarClock,
    Bell,
    CircleDollarSign,
} from "lucide-react";

const events = [
    {
        title: "Contribution Due",
        date: "Tomorrow",
        icon: CircleDollarSign,
    },
    {
        title: "Monthly Meeting",
        date: "Saturday",
        icon: CalendarClock,
    },
    {
        title: "Reminder",
        date: "Next Week",
        icon: Bell,
    },
];

export default function WorkspaceUpcoming() {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <h2 className="mb-5 text-lg font-semibold">

                Upcoming

            </h2>

            <div className="space-y-4">

                {events.map(event => {

                    const Icon = event.icon;

                    return (

                        <div
                            key={event.title}
                            className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"
                        >

                            <div className="rounded-xl bg-violet-100 p-3 text-violet-700">

                                <Icon size={18}/>

                            </div>

                            <div>

                                <p className="font-medium">

                                    {event.title}

                                </p>

                                <p className="text-sm text-slate-500">

                                    {event.date}

                                </p>

                            </div>

                        </div>

                    );

                })}

            </div>

        </section>
    );
}