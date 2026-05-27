import React from "react"
import { Link, useLocation } from "wouter"
import { LayoutDashboard, Building2, Settings, LogOut, Users, HelpCircle, UserRound } from "lucide-react"
import { useGetCurrentAuthUser, UserRole } from "@workspace/api-client-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/buyers", label: "Buyers", icon: UserRound },
  { href: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/admin/ai", label: "Config", icon: Settings, adminOnly: true },
  { href: "/help", label: "Help", icon: HelpCircle },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { data: authData } = useGetCurrentAuthUser()
  const user = authData?.user
  const isAdmin = user?.role === UserRole.admin

  const visibleNav = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-border bg-card flex flex-col shadow-sm z-10 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}images/logo-pin.png`} alt="Tour Flow" className="h-9 w-9 object-contain" />
            <span className="font-display font-bold text-xl tracking-tight text-foreground">Tour Flow</span>
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}>
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
            <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {user?.firstName?.[0] || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</span>
              <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={async () => {
                await fetch(`${import.meta.env.BASE_URL}api/logout`, { method: "POST", credentials: "include" })
                window.location.href = "/login"
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background/50 overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none -z-10" />
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
