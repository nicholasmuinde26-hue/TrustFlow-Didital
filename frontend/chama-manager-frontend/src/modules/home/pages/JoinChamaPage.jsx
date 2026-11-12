import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Landmark,
  Clock,
  XCircle,
  UserPlus,
  LogIn,
  KeyRound,
  Search,
  Sparkles,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Globe,
  X,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import useJoinChama from "@/modules/chama/hooks/useJoinChama";
import chamaService from "@/modules/chama/services/chama.service";
import AuthLayout from "@/layouts/AuthLayout";
import AuthCard from "@/modules/auth/components/AuthCard";
import Button from "@/shared/components/ui/Button";
import Spinner from "@/shared/components/ui/Spinner";
import { organizationLabel } from '@/modules/workspaces/index.js';

export default function JoinChamaPage() {
  const directoryTypes = {
    chama: [["merry_go_round", "Merry-go-round"], ["table_banking", "Table banking"], ["investment_group", "Investment group"], ["welfare", "Welfare / burial"], ["housing", "Housing group"], ["farmer_group", "Farmer group"], ["custom", "Other / custom"]],
    sacco: [["community_sacco", "Community SACCO"], ["employee_sacco", "Employee SACCO"], ["farmer_sacco", "Farmer SACCO"], ["housing_sacco", "Housing SACCO"], ["investment_sacco", "Investment SACCO"], ["custom", "Other / custom"]],
    cooperative: [["agricultural", "Agricultural cooperative"], ["consumer", "Consumer cooperative"], ["housing", "Housing cooperative"], ["worker", "Worker cooperative"], ["producer", "Producer cooperative"], ["custom", "Other / custom"]],
  };
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { workspaces = [] } = useWorkspace();
  const { previewInvite, previewing, previewError, acceptInvite, joining, joinError } =
    useJoinChama();

  // Chamas the user is already in — used to stop a duplicate join
  // request before it's ever sent, both for the public directory cards
  // and as a last-line guard in handleJoinWithCode.
  const myChamaWorkspaces = workspaces.filter(
    (w) => (w.type || "").toLowerCase() === "chama"
  );
  const myChamaIds = new Set(
    myChamaWorkspaces.map((w) => String(w.id ?? w._id))
  );

  // Invite Token preview state
  const [preview, setPreview] = useState(null);

  // Manual Code Input state
  const [inputCode, setInputCode] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState("");

  // Public Chamas directory state
  const [publicChamas, setPublicChamas] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [publicSearch, setPublicSearch] = useState("");
  const [directoryFamily, setDirectoryFamily] = useState("all");
  const [directoryType, setDirectoryType] = useState("all");
  const [authPromptChamaId, setAuthPromptChamaId] = useState(null);

  // Chamas the user already has an unapproved request pending for —
  // used alongside myChamaIds so the directory (and handleJoinWithCode)
  // can stop a duplicate request before the backend ever rejects it
  // with 409 "already pending approval".
  const [pendingChamaIds, setPendingChamaIds] = useState(new Set());

  // Request result state
  const [requestState, setRequestState] = useState("idle"); // idle | submitted | error
  const [requestMessage, setRequestMessage] = useState("");

  // Fetch invitation preview if token is provided
  useEffect(() => {
    if (!token) return;

    previewInvite(token)
      .then(setPreview)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) return;
    setLoadingPublic(true);
    setDirectoryError("");
    chamaService.getPublicChamas({
      ...(directoryFamily !== "all" ? { organizationFamily: directoryFamily } : {}),
      ...(directoryType !== "all" ? { organizationType: directoryType } : {}),
    }).then(setPublicChamas).catch((error) => {
      setDirectoryError(error?.response?.data?.message || "Could not load public organizations. Please try again.");
    }).finally(() => setLoadingPublic(false));
  }, [token, directoryFamily, directoryType]);

  // Fetch the user's own pending join requests so the directory can
  // mark chamas they've already requested to join.
  useEffect(() => {
    if (token || !isAuthenticated) return;

    chamaService
      .myPendingRequests()
      .then((requests) => {
        setPendingChamaIds(
          new Set(
            requests.map((r) => String(r.chama_id?._id ?? r.chama_id))
          )
        );
      })
      .catch(() => {});
  }, [token, isAuthenticated]);

  const authRedirectState = {
    from: {
      pathname: "/chamas/join",
      search: token ? `?token=${token}` : "",
    },
  };

  async function handleRequestToJoinToken() {
    try {
      const membership = await acceptInvite(token);
      setRequestState("submitted");
      setRequestMessage(
        membership?.status === "pending"
          ? "Your request has been sent. The chairperson or treasurer will review it shortly."
          : "You've joined the organization."
      );
    } catch (err) {
      setRequestState("error");
      setRequestMessage(
        err.response?.data?.message || "Unable to submit your request to join."
      );
    }
  }

  async function handleJoinWithCode() {
    const code = inputCode.trim();
    if (!code) {
      setCodeError("Please enter a valid invitation code.");
      return;
    }

    if (!isAuthenticated) {
      setAuthPromptChamaId(chamaId);
      return;
    }

    try {
      setCodeSubmitting(true);
      setCodeError("");
      const membership = await chamaService.joinWithCode(code);
      setRequestState("submitted");
      setRequestMessage(
        membership?.status === "pending"
          ? "Your request to join has been sent successfully. The chairperson or treasurer will review it shortly."
          : "You have joined the organization."
      );
    } catch (err) {
      setCodeError(
        err.response?.data?.message || "Invalid invitation code or unable to join."
      );
    } finally {
      setCodeSubmitting(false);
    }
  }

  // "Request to Join" on a public directory card — no invitation code
  // needed at all, since the Chama is already publicly visible. Tracks
  // its own per-card loading state (joiningChamaId) separately from the
  // manual code form above.
  const [joiningChamaId, setJoiningChamaId] = useState(null);
  const [directoryError, setDirectoryError] = useState("");

  async function handleRequestToJoinPublic(chamaId) {
    setDirectoryError("");

    if (!isAuthenticated) {
      navigate("/login", { state: authRedirectState });
      return;
    }

    // Check membership/pending state locally before sending anything
    // to the backend.
    if (myChamaIds.has(String(chamaId))) {
      setDirectoryError("You're already a member of this organization.");
      return;
    }
    if (pendingChamaIds.has(String(chamaId))) {
      setDirectoryError("You already have a request pending approval for this organization.");
      return;
    }

    try {
      setJoiningChamaId(chamaId);
      const membership = await chamaService.requestToJoinPublicChama(chamaId);
      setPendingChamaIds((prev) => new Set(prev).add(String(chamaId)));
      setRequestState("submitted");
      setRequestMessage(
        membership?.status === "pending"
          ? "Your request to join has been sent successfully. The chairperson or treasurer will review it shortly."
          : "You have joined the organization."
      );
    } catch (err) {
      setDirectoryError(
        err.response?.data?.message || "Unable to submit your request to join."
      );
    } finally {
      setJoiningChamaId(null);
    }
  }

  const filteredPublicChamas = publicChamas.filter((c) =>
    c.name.toLowerCase().includes(publicSearch.toLowerCase().trim())
  );

  // Main inner content component
  const content = (
    <div className="space-y-6">
      {/* SUCCESS STATE */}
      {requestState === "submitted" && (
        <div className="flex flex-col items-center py-8 text-center rounded-3xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-500/10 mb-4">
            <Clock size={40} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Request Submitted
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-md">
            {requestMessage}
          </p>
          <Link
            to="/workspaces"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-violet-700 transition-colors shadow-md"
          >
            Back to Workspaces
          </Link>
        </div>
      )}

      {/* ERROR STATE */}
      {requestState === "error" && (
        <div className="flex flex-col items-center py-8 text-center rounded-3xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 mb-4">
            <XCircle size={40} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Couldn't Submit Request
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-md">
            {requestMessage}
          </p>
          <Button
            className="mt-6"
            onClick={() => setRequestState("idle")}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* TOKEN LINK PREVIEW */}
      {token && requestState === "idle" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {(previewing || authLoading) && !preview && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading invitation preview...
              </p>
            </div>
          )}

          {!previewing && (previewError || (preview && !preview.valid)) && (
            <InvalidState
              message={
                previewError ||
                (preview?.expired
                  ? "This invite link has expired. Ask the chairperson or treasurer to send a new one."
                  : "This invite link is no longer valid.")
              }
            />
          )}

          {preview?.valid && (
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <Sparkles size={24} />
              </div>

              <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                You're invited to join {preview.chama?.name || "an organization"}
              </h2>

              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {preview.invited_by?.name
                  ? `Invited by ${preview.invited_by.name}. `
                  : ""}
                {isAuthenticated
                  ? "Send a request to join — the chairperson or treasurer will need to approve it before you get access."
                  : "Create an account or log in to request to join."}
              </p>

              {joinError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
                  {joinError}
                </div>
              )}

              <div className="mt-6 space-y-3">
                {isAuthenticated ? (
                  <Button
                    className="w-full py-3 text-sm font-bold"
                    disabled={joining}
                    onClick={handleRequestToJoinToken}
                  >
                    {joining
                      ? "Sending request..."
                      : `Request to Join${user?.name ? ` as ${user.name}` : ""}`}
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full py-3"
                      onClick={() =>
                        navigate("/register", { state: authRedirectState })
                      }
                    >
                      <UserPlus size={18} />
                      Create an Account to Join
                    </Button>

                    <Button
                      variant="secondary"
                      className="w-full py-3"
                      onClick={() =>
                        navigate("/login", { state: authRedirectState })
                      }
                    >
                      <LogIn size={18} />
                      I already have an account
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CODE ENTRY & PUBLIC DIRECTORY */}
      {!token && requestState === "idle" && (
        <div className="space-y-6">
          {/* 1. ENTER CODE CARD */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Enter Invitation Code
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Have a code shared by a Chairperson or Treasurer?
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinWithCode();
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                placeholder="e.g. A7X9B2"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-lg font-black tracking-widest text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white uppercase"
              />

              {codeError && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-center">
                  {codeError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full py-3 text-xs font-bold"
                disabled={codeSubmitting || !inputCode.trim()}
              >
                {codeSubmitting ? "Submitting request..." : "Join Organization with Code"}
              </Button>
            </form>
          </div>

          {/* 2. PUBLIC DIRECTORY */}
          <div className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:p-8">
            <div className="mb-5 grid min-w-0 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="text-violet-600 dark:text-violet-400" size={18} />
                  Browse Public Organizations
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Explore public chamas, SACCOs and cooperatives looking for new members
                </p>
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                {/* Search Bar */}
                <div className="relative min-w-0">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search public organizations..."
                    value={publicSearch}
                    onChange={(e) => setPublicSearch(e.target.value)}
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <select aria-label="Filter by organization" value={directoryFamily} onChange={(event) => { setDirectoryFamily(event.target.value); setDirectoryType("all"); }} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:flex-none">
                    <option value="all">All organizations</option><option value="chama">Chamas</option><option value="sacco">SACCOs</option><option value="cooperative">Cooperatives</option>
                  </select>
                  {directoryFamily !== "all" && <select aria-label="Filter by organization type" value={directoryType} onChange={(event) => setDirectoryType(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:flex-none">
                    <option value="all">All types</option>{directoryTypes[directoryFamily].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>}
                </div>
              </div>
            </div>

            {directoryError && (
              <p className="mb-3 text-xs font-semibold text-red-600 dark:text-red-400 text-center">
                {directoryError}
              </p>
            )}

            {loadingPublic ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Spinner />
                <p className="mt-2 text-xs text-slate-400">Loading public directory...</p>
              </div>
            ) : filteredPublicChamas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Landmark size={24} className="text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No public organizations found
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  {publicSearch
                    ? "No organization matched your search filter."
                    : "There are currently no public organizations listed. You can join directly using an invitation code above."}
                </p>
              </div>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {filteredPublicChamas.map((chama) => {
                  const myMembership = myChamaWorkspaces.find(
                    (w) => String(w.id ?? w._id) === String(chama._id)
                  );
                  const alreadyMember = Boolean(myMembership);
                  const requestPending = pendingChamaIds.has(String(chama._id));

                  return (
                    <div
                      key={chama._id}
                      className="flex min-w-0 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-violet-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-violet-500/40 dark:hover:bg-slate-800"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                            PUBLIC
                          </span>
                          <span className="ml-2 shrink-0 text-right text-[11px] font-semibold text-slate-500">
                            KES {chama.monthly_savings?.toLocaleString()} / mo
                          </span>
                        </div>
                        <div className="flex min-w-0 items-start gap-2.5">
                          {chama.has_public_profile && chama.public_profile?.logo_url && <img src={chama.public_profile.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white object-cover dark:border-slate-700" />}
                          <div className="min-w-0">
                            <h4 className="break-words text-sm font-bold text-slate-900 dark:text-white">{chama.name}</h4>
                            {chama.has_public_profile && (chama.public_profile?.tagline || chama.public_profile?.purpose || chama.public_profile?.description) && <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{chama.public_profile.tagline || chama.public_profile.purpose || chama.public_profile.description}</p>}
                          </div>
                        </div>
                        <p className="mt-1 break-words text-[11px] font-medium text-violet-700 dark:text-violet-300">
                          {organizationLabel(chama.organization_family || "chama", chama.workspace_config?.terminology?.workspace)} · {(directoryTypes[chama.organization_family || "chama"]?.find(([key]) => key === (chama.organization_type || "custom"))?.[1] || (chama.organization_type || "custom").replaceAll("_", " "))}
                        </p>
                        {chama.has_public_profile && chama.public_profile?.location && <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">{chama.public_profile.location}</p>}
                      </div>

                      {chama.has_public_profile && (
                        <Link
                          to={`/chama-profile/${chama._id}`}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
                        >
                          <Globe size={14} /> View public profile
                        </Link>
                      )}

                      {alreadyMember ? (
                        <Button
                          variant="secondary"
                          className="mt-4 w-full py-2 text-xs font-bold"
                          onClick={() =>
                            navigate(`/workspace/${myMembership.id ?? myMembership._id}`)
                          }
                        >
                          <CheckCircle2 size={13} />
                          Already a Member — Open
                        </Button>
                      ) : requestPending ? (
                        <Button
                          variant="secondary"
                          className="mt-4 w-full py-2 text-xs font-bold"
                          disabled
                        >
                          <Clock size={13} />
                          Request Pending Approval
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          className="mt-4 w-full py-2 text-xs font-bold"
                          disabled={joiningChamaId === chama._id}
                          onClick={() => handleRequestToJoinPublic(chama._id)}
                        >
                          {joiningChamaId === chama._id ? (
                            "Submitting request..."
                          ) : (
                            <>
                              Request to Join
                              <ArrowRight size={13} />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {authPromptChamaId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthPromptChamaId(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="join-auth-title" className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-7">
            <button type="button" onClick={() => setAuthPromptChamaId(null)} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><X size={18} /></button>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Users size={23} /></div>
            <h2 id="join-auth-title" className="pr-8 text-xl font-black text-slate-900 dark:text-white">Are you already using ChamaManager?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Sign in if you already have an account, or create one first. Then you can send your request to join {publicChamas.find((item) => String(item._id) === String(authPromptChamaId))?.name || "this organization"}.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button className="w-full py-3 text-sm font-bold" onClick={() => navigate("/login", { state: authRedirectState })}><LogIn size={17} />I have an account</Button>
              <Button variant="secondary" className="w-full py-3 text-sm font-bold" onClick={() => navigate("/register", { state: authRedirectState })}><UserPlus size={17} />Create account</Button>
            </div>
            <button type="button" onClick={() => setAuthPromptChamaId(null)} className="mt-4 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Maybe later</button>
          </section>
        </div>
      )}
    </div>
  );

  // If user is ALREADY SIGNED IN: render as a clean platform page inside platform layout
  if (isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-12 font-sans">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-violet-50 p-3.5 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
              <Landmark size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Join an Existing Organization
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Connect with your community treasury using an invitation code or explore public circles.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {content}
      </div>
    );
  }

  // If user is NOT LOGGED IN: render with AuthLayout guest frame
  return (
    <AuthLayout wide>
      <AuthCard>{content}</AuthCard>
    </AuthLayout>
  );
}

function InvalidState({ message }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <XCircle size={40} className="text-red-500 mb-2" />
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        Invalid Invitation
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <Link
        to="/chamas/join"
        className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-violet-600 hover:underline dark:text-violet-400"
      >
        Enter Join Code Manually
      </Link>
    </div>
  );
}
