import { createContext, useContext } from "react";

/**
 * Who this admin is and what they may do, shared with every admin page so
 * the shell fetches the profile once instead of each page asking again.
 * Provided by AdminLayout.
 */
export const AdminAccessContext = createContext(null);

export default function useAdminAccess() {
  const value = useContext(AdminAccessContext);
  if (!value) {
    throw new Error("useAdminAccess must be used inside AdminLayout.");
  }
  return value;
}
