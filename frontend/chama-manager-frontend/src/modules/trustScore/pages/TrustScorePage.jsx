import { useState } from "react";
import { RefreshCw, Share2, Copy, Ban, ExternalLink } from "lucide-react";

import Card from "@/shared/components/ui/Card/Card";
import CardHeader from "@/shared/components/ui/Card/CardHeader";
import CardContent from "@/shared/components/ui/Card/CardContent";
import PageHeader from "@/shared/components/ui/PageHeader";
import Button from "@/shared/components/ui/Button/Button";
import Spinner from "@/shared/components/ui/Spinner";
import Badge from "@/shared/components/ui/Badge";

import { useWorkspace } from "@/app/hooks/useWorkspace";
import { canManageTrustScore } from "@/modules/workspaces/permissions/Permissions";

import {
  useTrustScore,
  useGenerateTrustScore,
  useShareTrustScore,
  useRevokeTrustScoreShare,
} from "../hooks/useTrustScore";
import TrustScoreBreakdown from "../components/TrustScoreBreakdown";

function gradeColor(grade) {
  if (!grade) return "neutral";
  if (["A+", "A"].includes(grade)) return "success";
  if (["B+", "B"].includes(grade)) return "info";
  if (grade === "C") return "warning";
  return "danger";
}

export default function TrustScorePage() {
  const { workspaceId, workspaceType, membership } = useWorkspace();
  const [copied, setCopied] = useState(false);

  const { data: trustScore, isLoading, isError } = useTrustScore(workspaceId);
  const generateMutation = useGenerateTrustScore(workspaceId);
  const shareMutation = useShareTrustScore(workspaceId);
  const revokeMutation = useRevokeTrustScoreShare(workspaceId);

  const canManage = canManageTrustScore(membership?.role, workspaceType);

  const shareUrl = trustScore?.share_token
    ? `${window.location.origin}/trust-score/${trustScore.share_token}`
    : null;

  const handleGenerate = () => generateMutation.mutate();
  const handleShare = () => {
    if (trustScore?._id) shareMutation.mutate(trustScore._id);
  };
  const handleRevoke = () => {
    if (trustScore?._id) revokeMutation.mutate(trustScore._id);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Chama Trust Score"
        subtitle="A single, shareable report a bank, SACCO federation, or prospective member can act on — not just a claim, an artifact."
        action={
          canManage && (
            <Button
              variant="secondary"
              onClick={handleGenerate}
              loading={generateMutation.isPending}
              loadingLabel="Generating"
            >
              <RefreshCw size={16} />
              Refresh score
            </Button>
          )
        }
      />

      {isLoading && (
        <div className="py-12">
          <Spinner label="Loading trust score" />
        </div>
      )}

      {isError && (
        <p className="py-8 text-center text-sm text-red-600">
          Couldn't load the trust score. Try again in a moment.
        </p>
      )}

      {!isLoading && !isError && !trustScore && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-500">
              No trust score has been generated yet.
            </p>
            {canManage ? (
              <Button className="mt-4" onClick={handleGenerate} loading={generateMutation.isPending}>
                Generate the first score
              </Button>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Ask a treasurer or chairperson to generate one.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && trustScore && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center py-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Overall score
              </p>

              <div className="relative my-4 flex h-40 w-40 items-center justify-center">
                <svg className="h-40 w-40 -rotate-90 transform" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="9" fill="none" className="dark:stroke-obsidian-raised" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="9"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - Math.min(100, Math.max(0, trustScore.score || 0)) / 100)}
                    className="text-blue-600 dark:text-mint"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-black text-slate-900 dark:text-mist">
                    {trustScore.score ?? "—"}
                  </span>
                  {trustScore.grade && (
                    <Badge variant={gradeColor(trustScore.grade)}>{trustScore.grade}</Badge>
                  )}
                </div>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Generated {new Date(trustScore.createdAt).toLocaleDateString()}
              </p>

              {canManage && (
                <div className="mt-6 w-full space-y-2">
                  {!trustScore.is_public ? (
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={handleShare}
                      loading={shareMutation.isPending}
                    >
                      <Share2 size={16} />
                      Create share link
                    </Button>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Button fullWidth variant="secondary" onClick={handleCopy}>
                          <Copy size={16} />
                          {copied ? "Copied!" : "Copy link"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => window.open(shareUrl, "_blank")}
                        >
                          <ExternalLink size={16} />
                        </Button>
                      </div>
                      <Button
                        fullWidth
                        variant="danger"
                        onClick={handleRevoke}
                        loading={revokeMutation.isPending}
                      >
                        <Ban size={16} />
                        Revoke link
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Score breakdown"
              subtitle="Every component that fed the overall score, and why."
            />
            <CardContent>
              <TrustScoreBreakdown
                components={trustScore.components}
                componentsUsed={trustScore.components_used}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
