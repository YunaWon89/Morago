import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { CallOverlay } from "./call/CallOverlay";
import { Loading, ShellLayout } from "./components/Layout";
import { AdminPlaceholder } from "./pages/admin/Placeholder";
import { ForgotPassword, ResetPassword } from "./pages/auth/Recovery";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { ClientHome } from "./pages/client/Home";
import { Topics } from "./pages/client/Topics";
import { Translators } from "./pages/client/Translators";
import { Balance, TopUp, Withdraw } from "./pages/shared/Balance";
import { Calls } from "./pages/shared/Calls";
import { Chat, Messages } from "./pages/shared/Messages";
import { ChangePassword, Notifications, Profile, ProfileEdit } from "./pages/shared/Profile";
import { TranslatorHome } from "./pages/translator/Home";
import { TranslatorProfileEdit } from "./pages/translator/ProfileEdit";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  if (user?.role === "TRANSLATOR") return <TranslatorHome />;
  if (user?.role === "ADMIN") return <AdminPlaceholder />;
  return <ClientHome />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          element={
            <RequireAuth>
              <ShellLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/translators" element={<Translators />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/balance/topup" element={<TopUp />} />
          <Route path="/balance/withdraw" element={<Withdraw />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/profile/password" element={<ChangePassword />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/translator/profile" element={<TranslatorProfileEdit />} />
        </Route>

        <Route
          path="/messages/:id"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {user && <CallOverlay />}
    </>
  );
}
