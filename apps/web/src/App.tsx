import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { SoundAlerts } from "./components/SoundAlerts";
import { CallOverlay } from "./call/CallOverlay";
import { Loading, ShellLayout } from "./components/Layout";
import { AdminLayout, AdminLogin } from "./pages/admin/AdminLayout";
import { AdminDocuments } from "./pages/admin/AdminDocuments";
import { AdminCalls, AdminCategories, AdminLanguages, AdminThemes } from "./pages/admin/AdminLists";
import { AdminPayoutDetails, AdminPayouts, AdminTopups, AdminWithdrawHistory } from "./pages/admin/AdminMoney";
import { AdminTranslators } from "./pages/admin/AdminTranslators";
import { AdminCallHistory, AdminCharge, AdminDepositHistory, AdminUsers } from "./pages/admin/AdminUsers";
import { NotFound } from "./pages/ErrorPages";
import { ForgotPassword, ResetPassword } from "./pages/auth/Recovery";
import { Login } from "./pages/auth/Login";
import { Welcome, welcomeSeen } from "./pages/auth/Welcome";
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
  if (!user) return <Navigate to={welcomeSeen() ? "/login" : "/welcome"} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  if (user?.role === "TRANSLATOR") return <TranslatorHome />;
  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <ClientHome />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id/charge" element={<AdminCharge />} />
          <Route path="users/:id/calls" element={<AdminCallHistory kind="user" />} />
          <Route path="users/:id/deposits" element={<AdminDepositHistory />} />
          <Route path="translators" element={<AdminTranslators />} />
          <Route path="translators/:id/calls" element={<AdminCallHistory kind="translator" />} />
          <Route path="translators/:id/withdrawals" element={<AdminWithdrawHistory />} />
          <Route path="translators/:id/documents" element={<AdminDocuments />} />
          <Route path="languages" element={<AdminLanguages />} />
          <Route path="calls" element={<AdminCalls />} />
          <Route path="topups" element={<AdminTopups />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="payouts/:id" element={<AdminPayoutDetails />} />
          <Route path="themes" element={<AdminThemes />} />
          <Route path="categories" element={<AdminCategories />} />
        </Route>

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
        <Route path="*" element={<NotFound />} />
      </Routes>

      {user && <CallOverlay />}
      {user && <SoundAlerts />}
    </>
  );
}
