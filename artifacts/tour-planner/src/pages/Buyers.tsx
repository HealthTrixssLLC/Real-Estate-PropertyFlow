import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import {
  useListBuyers,
  useCreateBuyer,
  useUpdateBuyer,
  useDeleteBuyer,
  getListBuyersQueryKey,
} from "@workspace/api-client-react"
import type { Buyer } from "@workspace/api-client-react"
import { Plus, Users, Pencil, Trash2, AlertTriangle, Loader2, Mail, Phone, FileText, Eye } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"

interface BuyerFormValues {
  name: string
  email: string
  phone: string
  notes: string
}

const EMPTY_FORM: BuyerFormValues = { name: "", email: "", phone: "", notes: "" }

interface BuyerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Buyer | null
  onSaved: () => void
}

function BuyerFormDialog({ open, onOpenChange, initial, onSaved }: BuyerFormDialogProps) {
  const { toast } = useToast()
  const createBuyer = useCreateBuyer()
  const updateBuyer = useUpdateBuyer()
  const isEditing = !!initial

  const [form, setForm] = useState<BuyerFormValues>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { name: initial.name, email: initial.email ?? "", phone: initial.phone ?? "", notes: initial.notes ?? "" }
          : EMPTY_FORM
      )
      setError(null)
    }
  }, [open, initial])

  const set = (field: keyof BuyerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (isEditing && initial) {
        await updateBuyer.mutateAsync({
          buyerId: initial.id,
          data: {
            name: form.name,
            email: form.email || undefined,
            phone: form.phone || undefined,
            notes: form.notes || undefined,
          },
        })
        toast({ title: "Buyer updated" })
      } else {
        await createBuyer.mutateAsync({
          data: {
            name: form.name,
            email: form.email || undefined,
            phone: form.phone || undefined,
            notes: form.notes || undefined,
          },
        })
        toast({ title: "Buyer added" })
      }
      onSaved()
      onOpenChange(false)
    } catch {
      setError("Something went wrong. Please try again.")
    }
  }

  const isPending = createBuyer.isPending || updateBuyer.isPending

  return (
    <Dialog open={open} onOpenChange={v => { if (!isPending) { onOpenChange(v); setError(null) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Buyer" : "Add New Buyer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="b-name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="b-name" value={form.name} onChange={set("name")} required placeholder="Jane Smith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-email">Email</Label>
            <Input id="b-email" type="email" value={form.email} onChange={set("email")} placeholder="jane@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-phone">Phone</Label>
            <Input id="b-phone" value={form.phone} onChange={set("phone")} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-notes">Notes</Label>
            <Textarea id="b-notes" value={form.notes} onChange={set("notes")} rows={3} placeholder="Preferences, budget, priorities..." />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Buyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Buyers() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading } = useListBuyers()
  const deleteBuyer = useDeleteBuyer()
  const [, navigate] = useLocation()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Buyer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Buyer | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBuyersQueryKey() })

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteBuyer.mutateAsync({ buyerId: deleteTarget.id })
      await invalidate()
      toast({ title: "Buyer deleted" })
    } catch {
      toast({ title: "Failed to delete buyer", variant: "destructive" })
    } finally {
      setDeleteTarget(null)
    }
  }

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (b: Buyer) => { setEditing(b); setFormOpen(true) }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buyers</h1>
          <p className="text-muted-foreground mt-1">Manage your client profiles and assign them to tours.</p>
        </div>
        <Button onClick={openAdd} className="shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-transform gap-2">
          <Plus className="h-4 w-4" />
          Add Buyer
        </Button>
      </div>

      <Card className="border border-border/50 shadow-md shadow-black/5 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !data?.buyers.length ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <Users className="h-12 w-12 mb-4 text-muted" />
            <p className="text-lg font-medium">No buyers yet</p>
            <p className="text-sm mb-4">Add your first buyer to get started</p>
            <Button onClick={openAdd} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Buyer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Contact</th>
                  <th className="px-6 py-4 font-semibold">Notes</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.buyers.map(buyer => (
                  <tr
                    key={buyer.id}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/buyers/${buyer.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{buyer.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {buyer.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Mail className="h-3 w-3 shrink-0" />
                            <a
                              href={`mailto:${buyer.email}`}
                              className="hover:text-foreground transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              {buyer.email}
                            </a>
                          </div>
                        )}
                        {buyer.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Phone className="h-3 w-3 shrink-0" />
                            <a
                              href={`tel:${buyer.phone}`}
                              className="hover:text-foreground transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              {buyer.phone}
                            </a>
                          </div>
                        )}
                        {!buyer.email && !buyer.phone && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {buyer.notes ? (
                        <div className="flex items-start gap-1.5 text-muted-foreground text-xs max-w-xs">
                          <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{buyer.notes}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); navigate(`/buyers/${buyer.id}`) }}
                          title="View buyer detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); openEdit(buyer) }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(buyer) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BuyerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Buyer?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. Tours that referenced this buyer will have their buyer cleared. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
