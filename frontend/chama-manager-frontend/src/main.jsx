import ReactDOM from "react-dom/client";

import "./index.css";

import App from "./app/App";
import AppProvider from "./app/providers/Appprovider";


ReactDOM
  .createRoot(document.getElementById("root"))
  .render(
    <AppProvider>
      <App />
    </AppProvider>
  );