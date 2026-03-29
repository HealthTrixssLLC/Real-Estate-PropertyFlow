import React from "react"
import { useGetCurrentAuthUser } from "@workspace/api-client-react"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error } = useGetCurrentAuthUser()

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading Tour Flow...</p>
        </div>
      </div>
    )
  }

  if (error || !data?.user) {
    window.location.href = "/api/login"
    return null
  }

  return <>{children}</>
}
