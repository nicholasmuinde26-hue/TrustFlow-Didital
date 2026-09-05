import useWorkspace from "@/app/hooks/useWorkspace";

import MemberDashboardPage from "@/modules/chama/pages/MemberDashboardPage";
import BurialMemberDashboardPage from "@/modules/burialChama/pages/Burialmemberdashboardpage";

// The "My Chama" nav item routes here for every Chama-backed workspace.
// Burial Chamas are Chama documents underneath (same membership model),
// but members care about very different figures — welfare cover status,
// beneficiaries, burial cases — so they get their own view.
export default function MyChamaRouterPage() {
  const { isBurialChama } = useWorkspace();

  if (isBurialChama) {
    return <BurialMemberDashboardPage />;
  }

  return <MemberDashboardPage />;
}