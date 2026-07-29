import QueryProvider from "./QueryProvider";
import ThemeProvider from "./ThemeProvider";
import AuthProvider from "./AuthProvider";
import WorkspaceProvider from "./WorkspaceProvider";


export default function AppProvider({ children }) {
  return (
    <QueryProvider>

      <AuthProvider>

        <WorkspaceProvider>

          <ThemeProvider>
            {children}
          </ThemeProvider>

        </WorkspaceProvider>

      </AuthProvider>

    </QueryProvider>
  );
}