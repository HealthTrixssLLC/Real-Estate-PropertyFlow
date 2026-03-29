import { Switch, Route, Router as WouterRouter, useLocation } from "wouter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"

import { Shell } from "@/components/layout/Shell"
import { AuthGuard } from "@/components/shared/AuthGuard"
import { RoleGuard } from "@/components/shared/RoleGuard"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Properties from "@/pages/Properties"
import AdminAI from "@/pages/AdminAI"
import AdminUsers from "@/pages/AdminUsers"
import TourDetail from "@/pages/tour/TourDetail"
import TourCreate from "@/pages/tour/TourCreate"
import Help from "@/pages/Help"
import NotFound from "@/pages/not-found"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <Shell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/properties" component={Properties} />
          <Route path="/admin/ai">
            <RoleGuard roles={["admin"]}>
              <AdminAI />
            </RoleGuard>
          </Route>
          <Route path="/admin/users">
            <RoleGuard roles={["admin"]}>
              <AdminUsers />
            </RoleGuard>
          </Route>
          <Route path="/tours/new" component={TourCreate} />
          <Route path="/tours/:id" component={TourDetail} />
          <Route path="/help" component={Help} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </AuthGuard>
  )
}

function MainRouter() {
  const [loc] = useLocation()

  if (loc === "/login") {
    return <Login />
  }

  return <ProtectedRoutes />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <MainRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
