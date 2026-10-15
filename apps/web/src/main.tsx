import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CallProvider } from "./call/CallContext";
import { RealtimeProvider } from "./realtime/RealtimeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <RealtimeProvider>
        <CallProvider>
          <App />
        </CallProvider>
      </RealtimeProvider>
    </AuthProvider>
  </BrowserRouter>,
);
