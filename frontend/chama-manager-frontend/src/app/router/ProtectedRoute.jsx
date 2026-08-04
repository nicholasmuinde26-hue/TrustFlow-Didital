import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "@/app/hooks/useAuth";
import Spinner from "@/shared/components/ui/Spinner";

// Pure auth guard — no layout here. /home and /workspace/:id each supply
// their own layout (PlatformLayout / WorkspaceLayout) as nested routes,
// since they need very different shells.
export default function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner fullscreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }

  return <Outlet />;
}