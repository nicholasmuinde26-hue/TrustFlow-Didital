import QueryProvider from "./QueryProvider";
import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import WorkspaceProvider from "./WorkspaceProvider";
import SocketProvider from "./SocketProvider";
import LeadershipSessionProvider from "@/modules/leadership/context/LeadershipSessionProvider";


export default function AppProvider({ children }) {
  return (
    <QueryProvider>

      <AuthProvider>

        <SocketProvider>

          <WorkspaceProvider>

            <ThemeProvider>

              {/* Holds the Leadership Desk PIN session in memory and
                  renders the global step-up prompt. Sits inside
                  WorkspaceProvider (it reasons about the active chama)
                  but wraps everything below, so a high-risk call made
                  from ANY page — not just the desk — can raise the PIN
                  confirmation. */}
              <LeadershipSessionProvider>
                {children}
              </LeadershipSessionProvider>

            </ThemeProvider>

          </WorkspaceProvider>

        </SocketProvider>

      </AuthProvider>

    </QueryProvider>
  );
}