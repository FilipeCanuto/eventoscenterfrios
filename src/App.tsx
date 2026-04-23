import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Eager-load the landing page (most common entry point) for fast FCP/LCP
import Landing from "./pages/Landing";

// Lazy-load all other routes to reduce initial JS bundle size
const Auth = lazy(() => import("./pages/Auth"));
const Register = lazy(() => import("./pages/Register"));
const CompanyPage = lazy(() => import("./pages/CompanyPage"));
const PublicEvents = lazy(() => import("./pages/PublicEvents"));
const CheckIn = lazy(() => import("./pages/CheckIn"));
const UnsubscribeReminders = lazy(() => import("./pages/UnsubscribeReminders"));
const Events = lazy(() => import("./pages/dashboard/Events"));
const CreateEvent = lazy(() => import("./pages/dashboard/CreateEvent"));
const EventDetail = lazy(() => import("./pages/dashboard/EventDetail"));
const Attendees = lazy(() => import("./pages/dashboard/Attendees"));
const Analytics = lazy(() => import("./pages/dashboard/Analytics"));
const Integrations = lazy(() => import("./pages/dashboard/Integrations"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="app-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={null}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Landing />} />
                <Route path="/events" element={<PublicEvents />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/register/:slug" element={<Register />} />
                <Route path="/check-in/:registrationId" element={<CheckIn />} />
                <Route path="/unsubscribe-reminders/:token" element={<UnsubscribeReminders />} />
                <Route path="/company/:companySlug" element={<CompanyPage />} />

                {/* Dashboard (protected) */}
                <Route path="/dashboard" element={<Navigate to="/dashboard/events" replace />} />
                <Route path="/dashboard/*" element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Routes>
                        <Route path="events" element={<Events />} />
                        <Route path="events/create" element={<CreateEvent />} />
                        <Route path="events/:id" element={<EventDetail />} />
                        <Route path="events/:id/edit" element={<CreateEvent />} />
                        <Route path="attendees" element={<Attendees />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="integrations" element={<Integrations />} />
                        <Route path="settings" element={<SettingsPage />} />
                      </Routes>
                    </DashboardLayout>
                  </ProtectedRoute>
                } />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
