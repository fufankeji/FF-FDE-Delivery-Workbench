import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { initializeBackgroundTheme } from "./design/backgroundThemes";
import { initializeColorMode } from "./design/colorMode";
import "./styles/tokens.css";
import "./styles/app.css";

initializeBackgroundTheme();
initializeColorMode();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 4,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
