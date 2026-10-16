import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CallProvider } from "./call/CallContext";
import { ToastProvider } from "./components/Toast";
import { RealtimeProvider } from "./realtime/RealtimeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <RealtimeProvider>
          <CallProvider>
            <App />
          </CallProvider>
        </RealtimeProvider>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);
