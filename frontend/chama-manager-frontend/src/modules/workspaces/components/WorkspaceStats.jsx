import {
    Users,
    Wallet,
    TrendingUp,
    CalendarDays,
} from "lucide-react";

import StatCard from "@/shared/components/ui/StatCard";

export default function WorkspaceStats() {
    const stats = [
        {
            title: "Members",
            value: "24",
            description: "Active members",
            icon: Users,
            color: "violet",
        },
        {
            title: "Balance",
            value: "KES 120,000",
            description: "Current balance",
            icon: Wallet,
            color: "emerald",
        },
        {
            title: "Monthly Goal",
            value: "82%",
            description: "Contribution progress",
            icon: TrendingUp,
            color: "amber",
        },
        {
            title: "Next Meeting",
            value: "Tomorrow",
            description: "2:00 PM",
            icon: CalendarDays,
            color: "blue",
        },
    ];

    return (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
                <StatCard
                    key={stat.title}
                    {...stat}
                />
            ))}
        </section>
    );
}