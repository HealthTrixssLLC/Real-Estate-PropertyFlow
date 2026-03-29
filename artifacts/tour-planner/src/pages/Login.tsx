import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError("Username is required")
      return
    }
    if (!password) {
      setError("Password is required")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      })

      if (res.ok) {
        window.location.href = "/"
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Login failed. Please try again.")
      }
    } catch {
      setError("Network error. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side: Image */}
      <div className="hidden lg:flex flex-1 relative bg-muted overflow-hidden">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
          alt="Luxury living room" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 text-white p-6 backdrop-blur-sm bg-black/20 rounded-2xl border border-white/10 max-w-lg">
          <h2 className="text-3xl font-display font-bold mb-2 tracking-tight text-white">Master the Tour.</h2>
          <p className="text-white/80 text-lg">Plan routes, track approvals, and generate AI insights seamlessly from desk to driveway.</p>
        </div>
      </div>
      
      {/* Right side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3 text-center lg:text-left">
            <div className="mb-6">
              <img src={`${import.meta.env.BASE_URL}images/logo-wordmark.png`} alt="Tour Flow" className="h-14 object-contain mx-auto lg:mx-0" />
            </div>
            <h1 className="text-4xl font-display font-bold tracking-tight text-foreground">Tour Flow</h1>
            <p className="text-muted-foreground text-lg">Sign in to your agent dashboard</p>
          </div>
          
          <div className="bg-card p-8 rounded-2xl border border-border shadow-xl shadow-black/5 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive font-medium">{error}</p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground px-4">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
