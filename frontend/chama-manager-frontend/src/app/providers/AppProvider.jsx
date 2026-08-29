import QueryProvider from "./QueryProvider";
import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import WorkspaceProvider from "./WorkspaceProvider";
import SocketProvider from "./SocketProvider";


export default function AppProvider({ children }) {
  return (
    <QueryProvider>

      <AuthProvider>

        <SocketProvider>

          <WorkspaceProvider>

            <ThemeProvider>
              {children}
            </ThemeProvider>

          </WorkspaceProvider>

        </SocketProvider>

      </AuthProvider>

    </QueryProvider>
  );
}