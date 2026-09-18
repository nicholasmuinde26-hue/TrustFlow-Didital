import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import router from "./router/router";
import { MarketplaceCartProvider } from "@/modules/marketplace/context/MarketplaceCartContext";

export default function App() {
  return (
    <MarketplaceCartProvider>
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 5000,
          style: {
            background: '#fff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
          }
        }}
      />
      <RouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
    </MarketplaceCartProvider>
  );
}