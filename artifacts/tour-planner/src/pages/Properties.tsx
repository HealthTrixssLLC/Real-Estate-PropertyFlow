import { useState } from "react"
import { useListProperties, useCreateProperty } from "@workspace/api-client-react"
import { Building2, Plus, Home, DollarSign, Search, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export default function Properties() {
  const { data, isLoading } = useListProperties()
  const createProperty = useCreateProperty()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = data?.properties.filter(p => 
    p.formattedAddress.toLowerCase().includes(search.toLowerCase()) || 
    p.mlsId?.toLowerCase().includes(search.toLowerCase())
  ) || []

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await createProperty.mutateAsync({
        data: {
          formattedAddress: fd.get("formattedAddress") as string,
          mlsId: fd.get("mlsId") as string || undefined,
          listPrice: Number(fd.get("listPrice")) || undefined,
          beds: Number(fd.get("beds")) || undefined,
          baths: Number(fd.get("baths")) || undefined,
          squareFeet: Number(fd.get("squareFeet")) || undefined,
          nickname: fd.get("nickname") as string || undefined,
          notes: fd.get("notes") as string || undefined,
        }
      })
      toast({ title: "Property added" })
      setIsOpen(false)
    } catch (err) {
      toast({ title: "Failed to add", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Database</h1>
          <p className="text-muted-foreground mt-1">Manage listings and homes for your tours.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/25">
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Address *</Label>
                <Input name="formattedAddress" required placeholder="123 Oak St, City, State" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>MLS ID</Label>
                  <Input name="mlsId" placeholder="#1234567" />
                </div>
                <div className="space-y-2">
                  <Label>List Price</Label>
                  <Input name="listPrice" type="number" placeholder="500000" />
                </div>
                <div className="space-y-2">
                  <Label>Beds</Label>
                  <Input name="beds" type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Baths</Label>
                  <Input name="baths" type="number" step="0.5" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Agent Notes</Label>
                  <Textarea name="notes" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProperty.isPending}>Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-2 flex items-center gap-2 border-border/50 shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <Input 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search properties by address or MLS..." 
          className="border-0 shadow-none focus-visible:ring-0 text-base"
        />
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No properties found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(prop => (
            <Card key={prop.id} className="overflow-hidden hover:shadow-xl transition-all border-border/50 group">
              <div className="h-32 bg-muted relative flex items-center justify-center">
                <Home className="h-10 w-10 text-muted-foreground/30" />
                <div className="absolute top-3 left-3 flex gap-2">
                  {prop.mlsId && <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm shadow-sm">MLS: {prop.mlsId}</Badge>}
                </div>
              </div>
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{prop.formattedAddress}</h3>
                  <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {prop.city || 'Unknown City'}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50 text-sm">
                  <div className="text-center">
                    <span className="block font-bold text-foreground">{prop.beds || '-'}</span>
                    <span className="text-muted-foreground text-xs">Beds</span>
                  </div>
                  <div className="text-center border-x border-border/50">
                    <span className="block font-bold text-foreground">{prop.baths || '-'}</span>
                    <span className="text-muted-foreground text-xs">Baths</span>
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-foreground">{prop.squareFeet ? `${prop.squareFeet}` : '-'}</span>
                    <span className="text-muted-foreground text-xs">Sq.Ft</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="font-bold text-lg text-primary">
                    {prop.listPrice ? `$${prop.listPrice.toLocaleString()}` : 'Price unlisted'}
                  </div>
                  <Button variant="outline" size="sm" className="hover-elevate">Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
