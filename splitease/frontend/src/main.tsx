import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ShopProvider } from "./features/shops/useShop";
import "./styles/globals.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShopProvider>
      <App />
    </ShopProvider>
  </StrictMode>,
);
