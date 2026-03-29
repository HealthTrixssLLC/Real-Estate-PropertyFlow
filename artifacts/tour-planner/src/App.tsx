import { Switch, Route, Router as WouterRouter, useLocation } from "wouter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"

// Pages & Layout
import { Shell } from "@/components/layout/Shell"
import { AuthGuard } from "@/components/shared/AuthGuard"
import Login from "@/pages/Login"
import Dashboard from "@/pages/Dashboard"
import Properties from "@/pages/Properties"
import AdminAI from "@/pages/AdminAI"
import TourDetail from "@/pages/tour/TourDetail"
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
          <Route path="/admin/ai" component={AdminAI} />
          <Route path="/tours/:id" component={TourDetail} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </AuthGuard>
  )
}

function MainRouter() {
  const [loc] = useLocation()
  
  if (loc === '/login') {
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
