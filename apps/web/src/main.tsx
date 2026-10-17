import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CallProvider } from "./call/CallContext";
import { ApiErrorToasts } from "./components/ApiErrorToasts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { RealtimeProvider } from "./realtime/RealtimeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ApiErrorToasts />
          <RealtimeProvider>
            <CallProvider>
              <App />
            </CallProvider>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </BrowserRouter>,
);
