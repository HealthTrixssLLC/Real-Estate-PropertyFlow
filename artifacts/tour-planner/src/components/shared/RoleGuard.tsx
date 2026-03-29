import React from "react"
import { useGetCurrentAuthUser } from "@workspace/api-client-react"
import { ShieldAlert } from "lucide-react"

interface RoleGuardProps {
  roles: string[]
  children: React.ReactNode
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { data } = useGetCurrentAuthUser()
  const userRole = data?.user?.role

  if (!userRole || !roles.includes(userRole)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground text-sm">
            You don't have permission to view this page. Contact your administrator if you need access.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
