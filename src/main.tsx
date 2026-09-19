import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { createQueryClient } from "./queryClient";
import { itemService } from "./services/itemService";
import "./App.css";

const queryClient = createQueryClient();

// Started before anything renders, so the item data is locked for loading before any page can ask
// for an item and find it missing.
void itemService.prepareItemData();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Served from /<repo>/ on GitHub Pages, so routes sit under the same prefix the
          bundler was given. BASE_URL is Vite's `base`, which is "/" for a local build. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
