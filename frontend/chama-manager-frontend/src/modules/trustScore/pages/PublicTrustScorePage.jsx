import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldAlert } from "lucide-react";

import Card from "@/shared/components/ui/Card/Card";
import CardContent from "@/shared/components/ui/Card/CardContent";
import Spinner from "@/shared/components/ui/Spinner";
import Badge from "@/shared/components/ui/Badge";

import { usePublicTrustScore } from "../hooks/useTrustScore";
import TrustScoreBreakdown from "../components/TrustScoreBreakdown";

function gradeColor(grade) {
  if (!grade) return "neutral";
  if (["A+", "A"].includes(grade)) return "success";
  if (["B+", "B"].includes(grade)) return "info";
  if (grade === "C") return "warning";
  return "danger";
}

export default function PublicTrustScorePage() {
  const { token } = useParams();
  const { data: report, isLoading, isError } = usePublicTrustScore(token);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <ShieldCheck size={18} />
          Independently generated Chama Trust Score
        </div>

        {isLoading && (
          <div className="py-16">
            <Spinner label="Loading report" />
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ShieldAlert size={32} className="text-red-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                This link is invalid or has been revoked
              </p>
              <p className="text-xs text-slate-400">
                Ask the chama for a current share link.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && report && (
          <div className="space-y-6">
            <Card>
              <CardContent className="flex flex-col items-center py-10 text-center">
                <p className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {report.chama?.name}
                </p>
                <p className="text-xs text-slate-400">
                  {report.chama?.active_member_count} active members ·{" "}
                  {report.chama?.chama_type || "standard"} chama
                </p>

                <p className="mt-6 text-6xl font-bold text-slate-900 dark:text-slate-50">
                  {report.score ?? "—"}
                </p>
                {report.grade && (
                  <Badge variant={gradeColor(report.grade)}>{report.grade}</Badge>
                )}

                <p className="mt-4 text-xs text-slate-400">
                  Report generated {new Date(report.generatedAt).toLocaleDateString()}
                  {report.sharedAt &&
                    ` · shared ${new Date(report.sharedAt).toLocaleDateString()}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <p className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Score breakdown
                </p>
                <TrustScoreBreakdown
                  components={report.components}
                  componentsUsed={report.componentsUsed}
                />
              </CardContent>
            </Card>

            <p className="text-center text-xs text-slate-400">
              This report reflects only aggregate figures — no member names, official
              identities, or dispute content are included.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
