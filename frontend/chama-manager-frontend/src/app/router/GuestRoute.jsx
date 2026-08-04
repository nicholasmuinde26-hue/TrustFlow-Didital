import { Navigate, Outlet } from "react-router-dom";

import useAuth from "../hooks/useAuth";

import Spinner from "@/shared/components/ui/Spinner";

export default function GuestRoute() {
  const {
    loading,
    isAuthenticated,
  } = useAuth();

  if (loading) {
    return <Spinner fullscreen />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to="/home"
        replace
      />
    );
  }

  return <Outlet />;
}