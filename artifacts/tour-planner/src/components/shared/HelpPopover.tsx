import { HelpCircle } from "lucide-react"
import { Link } from "wouter"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface HelpPopoverProps {
  title: string
  description: string
  helpSection?: string
  className?: string
}

export function HelpPopover({ title, description, helpSection, className }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
            className
          )}
          aria-label={`Help: ${title}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="font-semibold text-sm text-foreground">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {helpSection && (
            <Link
              href={`/help#${helpSection}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium mt-1"
            >
              Learn more in Help docs →
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
