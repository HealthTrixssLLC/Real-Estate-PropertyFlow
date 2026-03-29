import { useState } from "react"
import { useGetCurrentAuthUser } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlus, Users } from "lucide-react"

interface UserRecord {
  id: string
  username: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  role: string
  isActive: boolean
  createdAt: string
}

function useAdminUsers() {
  return useQuery<{ users: UserRecord[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/users`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch users")
      return res.json()
    },
  })
}

function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      username: string
      password: string
      role: "agent" | "assistant"
      firstName?: string
      lastName?: string
      email?: string
    }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed to create user")
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  })
}

function usePatchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { isActive?: boolean; role?: string } }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update user")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  })
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"agent" | "assistant">("agent")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const createUser = useCreateUser()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!username.trim()) { setFormError("Username is required"); return }
    if (password.length < 6) { setFormError("Password must be at least 6 characters"); return }

    try {
      await createUser.mutateAsync({
        username: username.trim(),
        password,
        role,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
      })
      setOpen(false)
      setUsername("")
      setPassword("")
      setRole("agent")
      setFirstName("")
      setLastName("")
      setEmail("")
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cu-first">First Name</Label>
              <Input id="cu-first" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-last">Last Name</Label>
              <Input id="cu-last" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Username <span className="text-destructive">*</span></Label>
            <Input id="cu-username" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. jsmith" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password <span className="text-destructive">*</span></Label>
            <Input id="cu-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-role">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as "agent" | "assistant")}>
              <SelectTrigger id="cu-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminUsers() {
  const { data: authData } = useGetCurrentAuthUser()
  const { data, isLoading, error } = useAdminUsers()
  const patchUser = usePatchUser()

  if (authData?.user?.role !== "admin") {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Access restricted.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground text-sm">Create and manage user accounts</p>
          </div>
        </div>
        <CreateUserDialog />
      </div>

      {isLoading && (
        <div className="text-muted-foreground text-sm py-8 text-center">Loading users...</div>
      )}
      {error && (
        <div className="text-destructive text-sm py-8 text-center">Failed to load users</div>
      )}

      {data?.users && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Username</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">No users yet. Add one above.</td>
                </tr>
              )}
              {data.users.map(user => (
                <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground italic">No name</span>}
                    </div>
                    {user.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.username ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.isActive ? "default" : "outline"} className={user.isActive ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : "text-muted-foreground"}>
                      {user.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={patchUser.isPending}
                      onClick={() => patchUser.mutate({ id: user.id, data: { isActive: !user.isActive } })}
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
