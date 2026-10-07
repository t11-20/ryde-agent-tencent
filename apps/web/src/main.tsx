import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveApiClient, type ApiClient } from "./api/client";
import { App } from "./App";
import { apiBase, apiMode } from "./config";
import "./styles.css";

async function makeClient(): Promise<ApiClient> {
  if (apiMode() === "mock") {
    // DEV MOCK: development only, off by default.
    const { MockApiClient } = await import("./mock/client");
    return new MockApiClient();
  }
  return new LiveApiClient(apiBase());
}

void makeClient().then((client) => {
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App client={client} />
    </StrictMode>,
  );
});
