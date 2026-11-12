import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import router from "./router";
import { MarketplaceCartProvider } from "@/context/MarketplaceCartContext";

export default function App() {
  return (
    <MarketplaceCartProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <RouterProvider router={router} />
    </MarketplaceCartProvider>
  );
}
