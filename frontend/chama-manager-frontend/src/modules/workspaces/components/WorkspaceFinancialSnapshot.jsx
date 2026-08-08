import {
    Wallet,
    PiggyBank,
    Landmark,
    TrendingUp,
} from "lucide-react";

const items = [
    {
        title: "Current Balance",
        value: "KES 120,000",
        icon: Wallet,
        color: "emerald",
    },
    {
        title: "Savings",
        value: "KES 84,500",
        icon: PiggyBank,
        color: "violet",
    },
    {
        title: "Loans",
        value: "KES 35,000",
        icon: Landmark,
        color: "amber",
    },
    {
        title: "Cash Flow",
        value: "Healthy",
        icon: TrendingUp,
        color: "blue",
    },
];

export default function WorkspaceFinancialSnapshot() {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="mb-6">
                <h2 className="text-lg font-semibold">
                    Financial Snapshot
                </h2>

                <p className="text-sm text-slate-500">
                    Current financial position
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">

                {items.map(item => {

                    const Icon = item.icon;

                    return (

                        <div
                            key={item.title}
                            className="rounded-2xl border border-slate-100 p-5 dark:border-slate-800"
                        >

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-slate-500">

                                        {item.title}

                                    </p>

                                    <h3 className="mt-2 text-xl font-bold">

                                        {item.value}

                                    </h3>

                                </div>

                                <div className="rounded-xl bg-violet-100 p-3 text-violet-700">

                                    <Icon size={20}/>

                                </div>

                            </div>

                        </div>

                    );

                })}

            </div>

        </section>
    );
}