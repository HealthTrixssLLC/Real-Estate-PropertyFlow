import { Map, Navigation } from "lucide-react"

export default function MapTab({ stops }: { stops: any[] }) {
  return (
    <div className="flex flex-col h-[600px] bg-muted/10 rounded-b-2xl relative overflow-hidden">
      {/* Decorative background grid representing map tiles */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-50" />
      
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
        <div className="bg-background/80 backdrop-blur-md p-8 rounded-2xl border border-border shadow-xl max-w-md w-full">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary shadow-inner">
            <Map className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Interactive Map View</h2>
          <p className="text-muted-foreground mb-6">
            Google Maps JavaScript API integration required to render the interactive route map with color-coded markers.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3 border border-border/50">
            <h4 className="font-semibold text-sm flex items-center gap-2 uppercase tracking-wide">
              <Navigation className="h-4 w-4 text-primary" />
              Route Data Ready
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Stops:</span>
                <span className="font-medium">{stops.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Markers Data:</span>
                <span className="font-medium text-green-600">Available (Lat/Lng)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
