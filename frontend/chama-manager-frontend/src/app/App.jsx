import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import router from "./router/router";
import { MarketplaceCartProvider } from "@/modules/marketplace/context/MarketplaceCartContext";
import RealtimeNotificationHost from "@/modules/notifications/components/RealtimeNotificationHost";

// Follows the app's light/dark switch (ThemeProvider toggles the "dark"
// class on <html>) so plain toast.success / toast.error calls match the
// rest of the UI instead of always being a white card.
function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() =>
      setIsDark(root.classList.contains("dark"))
    );
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const LIGHT = {
  background: "#ffffff",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  boxShadow: "0 12px 28px -8px rgb(15 23 42 / 0.18)",
};

const DARK = {
  background: "#172623", // obsidian-card
  color: "#e8f5ef", // mist
  border: "1px solid #20342f", // obsidian-border
  boxShadow: "0 12px 28px -8px rgb(0 0 0 / 0.5)",
};

export default function App() {
  const isDark = useIsDark();

  return (
    <MarketplaceCartProvider>
      <Toaster
        position="top-right"
        gutter={12}
        // Sits just under the 80px top bar so popups never cover the
        // bell, theme switch or profile menu.
        containerStyle={{ top: 88, right: 16 }}
        toastOptions={{
          duration: 4500,
          style: {
            ...(isDark ? DARK : LIGHT),
            borderRadius: 14,
            padding: "12px 14px",
            fontSize: 14,
            maxWidth: 380,
          },
          success: {
            iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
          },
          error: {
            duration: 6500,
            iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
          },
        }}
      />

      {/* Live notification popups (socket + polling fallback). */}
      <RealtimeNotificationHost router={router} onNavigate={(to) => router.navigate(to)} />

      <RouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
    </MarketplaceCartProvider>
  );
}
