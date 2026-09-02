import { Navigate, Outlet } from "react-router-dom";

import useAuth from "../hooks/useAuth";

import Spinner from "@/shared/components/ui/Spinner";

export default function GuestRoute() {
  const {
    loading,
    isAuthenticated,
    suppressGuestRedirect,
  } = useAuth();

  if (loading) {
    return <Spinner fullscreen />;
  }

  // Normally, an authenticated visitor on a guest-only route (login/
  // register) gets bounced to /home. But right after OTP verification,
  // isAuthenticated flips true a beat before LoginPage/RegisterPage
  // have finished deciding where to send the person (their own
  // workspace picker vs. /home). Suppressing the redirect here lets
  // that page keep control of navigation instead of losing the race.
  if (isAuthenticated && !suppressGuestRedirect) {
    return (
      <Navigate
        to="/home"
        replace
      />
    );
  }

  return <Outlet />;
}