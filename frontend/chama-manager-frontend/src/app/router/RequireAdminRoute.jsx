import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "@/app/hooks/useAuth";
import Spinner from "@/shared/components/ui/Spinner";

export default function RequireAdminRoute({ requireSuperAdmin = false }) {
  const { loading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Spinner fullscreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isSuper = user?.systemRole === "super_admin";
  const isAdmin = isSuper || user?.systemRole === "sub_admin";

  if (requireSuperAdmin && !isSuper) {
    return <Navigate to="/admin" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
