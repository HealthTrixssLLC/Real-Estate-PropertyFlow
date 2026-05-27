import { useState } from "react"
import { useCreateBuyer, useListBuyers, getListBuyersQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface BuyerSelectProps {
  name?: string
  value?: string
  onValueChange?: (value: string) => void
}

export default function BuyerSelect({ name, value, onValueChange }: BuyerSelectProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: buyersData } = useListBuyers()
  const createBuyer = useCreateBuyer()

  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleCreateBuyer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const result = await createBuyer.mutateAsync({
        data: {
          name: newName,
          email: newEmail || undefined,
          phone: newPhone || undefined,
          notes: newNotes || undefined,
        },
      })
      await queryClient.invalidateQueries({ queryKey: getListBuyersQueryKey() })
      onValueChange?.(result.buyer.id)
      toast({ title: "Buyer created", description: `${newName} has been added to your buyers.` })
      setNewOpen(false)
      setNewName("")
      setNewEmail("")
      setNewPhone("")
      setNewNotes("")
    } catch {
      setError("Failed to create buyer. Please try again.")
    }
  }

  const handleSelectChange = (v: string) => {
    if (v === "__new__") {
      setNewOpen(true)
      return
    }
    onValueChange?.(v)
  }

  return (
    <>
      <Select name={name} value={value} onValueChange={handleSelectChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a buyer (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No buyer</SelectItem>
          {buyersData?.buyers.map(b => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
          <SelectItem value="__new__" className="text-primary font-medium">
            <div className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Buyer…
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={newOpen} onOpenChange={v => { if (!createBuyer.isPending) { setNewOpen(v); setError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Buyer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBuyer} className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="nb-name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="nb-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-email">Email</Label>
              <Input
                id="nb-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-phone">Phone</Label>
              <Input
                id="nb-phone"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-notes">Notes</Label>
              <Textarea
                id="nb-notes"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                rows={2}
                placeholder="Preferences, budget, priorities..."
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)} disabled={createBuyer.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBuyer.isPending}>
                {createBuyer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Buyer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
