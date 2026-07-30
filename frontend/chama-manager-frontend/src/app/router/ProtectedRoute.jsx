import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "@/app/hooks/useAuth";
import DashboardLayout from "@/layouts/DashboardLayout";
import Spinner from "@/shared/components/ui/Spinner";

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

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}