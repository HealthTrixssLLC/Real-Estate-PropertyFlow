import { HelpCircle, BookOpen, Rocket, Map, Building2, ListChecks, CheckCircle2, Mic, Bot, ChevronRight } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface SectionDef {
  id: string
  title: string
  icon: React.ElementType
}

const sections: SectionDef[] = [
  { id: "getting-started", title: "Getting Started", icon: Rocket },
  { id: "dashboard", title: "Dashboard", icon: Building2 },
  { id: "creating-tour", title: "Creating a Tour", icon: Map },
  { id: "route-optimization", title: "Route Optimization", icon: Map },
  { id: "showings", title: "Showings & Approvals", icon: ListChecks },
  { id: "readiness", title: "Readiness Checklist", icon: CheckCircle2 },
  { id: "voice-notes", title: "Voice Notes & Transcription", icon: Mic },
  { id: "ai-summary", title: "AI Tour Summary", icon: Bot },
]

export default function Help() {
  const [activeSection, setActiveSection] = useState("getting-started")
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="flex gap-8 max-w-6xl mx-auto pb-20">
      <aside className="w-56 flex-shrink-0 hidden lg:block">
        <div className="sticky top-4 space-y-1">
          <div className="flex items-center gap-2 mb-4 px-3">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Help Contents</span>
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
                activeSection === s.id
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <s.icon className="h-3.5 w-3.5 flex-shrink-0" />
              {s.title}
            </button>
          ))}
        </div>
      </aside>

      <div ref={contentRef} className="flex-1 space-y-16 min-w-0">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
            <p className="text-muted-foreground mt-1">Everything you need to use TourFlow effectively.</p>
          </div>
        </div>

        <HelpSection id="getting-started" title="Getting Started" icon={Rocket}>
          <p className="text-muted-foreground mb-6">Get from sign-in to your first completed tour in under 5 minutes.</p>
          <div className="space-y-4">
            {[
              {
                step: 1,
                title: "Sign In",
                desc: "Log in with your agent credentials at the TourFlow web app. Your dashboard loads automatically after sign-in.",
              },
              {
                step: 2,
                title: "Create a Tour",
                desc: 'Click "New Tour" on the Dashboard. Enter a title, select the tour date, assign a client buyer, and set an optional start address. Save the tour to open the tour detail view.',
              },
              {
                step: 3,
                title: "Add Properties",
                desc: 'Open the "Route Stops" tab. Click "Add Stop" and search for a property address or pick from your saved properties. Each stop is added to your itinerary in order.',
              },
              {
                step: 4,
                title: "Optimize the Route",
                desc: "On the Map tab, your stops appear as numbered pins connected by a route line. Drag stops in the Route Stops tab to reorder them for a more efficient driving path.",
              },
              {
                step: 5,
                title: "Track Showing Approvals",
                desc: 'Open the "Showings" tab and fill in the listing agent contact details for each stop. Update the approval status as you hear back — Approved, Pending, Declined, etc.',
              },
              {
                step: 6,
                title: "Publish to Mobile",
                desc: 'Once your approvals look good, open the "Readiness" tab and tap "Publish to Mobile App". Your tour will appear on your phone in the TourFlow mobile app.',
              },
              {
                step: 7,
                title: "Execute on Mobile",
                desc: "On the day of the tour, open TourFlow on your iOS device. Tap your tour to enter Active Tour mode. Navigate to each stop, tap Mark Arrived, record voice notes or star ratings, then tap Complete Showing to move to the next stop.",
              },
              {
                step: 8,
                title: "Review the AI Summary",
                desc: 'After visiting all stops, tap "Tour Summary" on the mobile app. TourFlow generates an AI-powered summary of your ratings and notes, giving you a ready-to-share recap.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
                  {step}
                </div>
                <div className="pt-0.5">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-muted-foreground text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </HelpSection>

        <HelpSection id="dashboard" title="Dashboard" icon={Building2}>
          <p className="text-muted-foreground mb-4">The Dashboard is your home base. It shows a snapshot of all your tours.</p>
          <FeatureList items={[
            { title: "Stat cards", desc: "Total Tours, Active Drafts, Published tours, and Total Buyers are shown at the top. These update automatically as you create and publish tours." },
            { title: "Recent Tours table", desc: "Every tour is listed with its date, assigned client, status badge, geographic area, and readiness indicator. Click the Manage button to open any tour." },
            { title: "Status meanings", desc: "Draft = still being planned. Active = all approvals gathered, ready to review. Published = sent to mobile app. Completed = tour day is done." },
            { title: "New Tour button", desc: 'Click "New Tour" in the top-right to start creating a new itinerary.' },
          ]} />
        </HelpSection>

        <HelpSection id="creating-tour" title="Creating & Editing a Tour" icon={Map}>
          <p className="text-muted-foreground mb-4">Every tour starts with basic details, then gets properties added as stops.</p>

          <SubHeading>Tour Details Form</SubHeading>
          <FeatureList items={[
            { title: "Title", desc: "Give the tour a descriptive name, e.g. 'Weekend Homes for Smith Family — June 7'." },
            { title: "Date & Start Time", desc: "Set the calendar date and optionally a start time so you know when to leave." },
            { title: "Client (Buyer)", desc: "Assign the tour to a buyer contact from your buyer list. This links their name to the tour on the dashboard." },
            { title: "Start / End Address", desc: "Enter a starting address (your office or the buyer's home) so route calculations begin from the right place." },
            { title: "Geographic Area", desc: "A freeform label like 'Westside LA' or 'Downtown Seattle' helps you filter tours later." },
            { title: "Tags", desc: "Comma-separated keywords like 'luxury, pool, 4bd' help identify the buyer's priorities at a glance." },
          ]} />

          <SubHeading>Route Stops Tab</SubHeading>
          <FeatureList items={[
            { title: "Adding a stop", desc: "Click Add Stop, type an address into the search field, and select the matching result. The stop is geocoded automatically." },
            { title: "Reordering stops", desc: "Use the up/down arrows next to each stop to change the visit sequence. The map route updates to reflect your new order." },
            { title: "Stop details", desc: "Each stop card shows the address, showing approval status, property specs (beds, baths, price) and any quick notes from the field." },
          ]} />
        </HelpSection>

        <HelpSection id="route-optimization" title="Route Optimization" icon={Map}>
          <p className="text-muted-foreground mb-4">The Map tab gives you a visual overview of your entire tour route.</p>
          <FeatureList items={[
            { title: "Color-coded pins", desc: "Each stop pin is colored by its showing approval status: green = approved, amber = pending, red = declined, blue = requested, gray = not requested yet." },
            { title: "Route line", desc: "A purple line connects your stops in sequence with direction arrows so you can see at a glance how the driving flows." },
            { title: "Stop info popups", desc: "Click any pin to see the address, specs, and showing status without leaving the map." },
            { title: "Manual reordering", desc: "Go back to the Route Stops tab to reorder stops. Drag or use arrows — the map updates immediately." },
            { title: "Route Summary card", desc: "The Route Summary overlay in the top-right shows total stops and a legend for all status colors." },
            { title: "Missing coordinates", desc: "A warning banner appears if any stops could not be geocoded. Visit the Showings tab and verify the address for affected stops." },
          ]} />
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <strong>Tip:</strong> Organize stops geographically to minimize backtracking. Start with the farthest stop and work your way back toward your ending location.
          </div>
        </HelpSection>

        <HelpSection id="showings" title="Showings & Approvals" icon={ListChecks}>
          <p className="text-muted-foreground mb-4">The Showings tab is where you track access requests and approvals for each property.</p>
          <FeatureList items={[
            { title: "Adding agent info", desc: "For each stop, expand the row and enter the listing agent's name, brokerage, phone, and email. This info is also accessible on mobile so you can call or email from the field." },
            { title: "Approval status", desc: "Update the status as you hear back: Pending, Approved, Declined, Needs Follow-up, or Restricted (limited access conditions apply)." },
            { title: "Restriction notes", desc: "If a property has special entry requirements (gate code, remove shoes, occupied, time window), use the restriction section. These notes appear as a warning banner on the mobile app during the tour." },
            { title: "Agent notes", desc: "Any freeform notes from the listing agent can be saved here. They appear on the mobile stop detail screen." },
            { title: "Declined stops", desc: "Declined stops are still included in the tour but highlighted in red on the mobile app. You can choose to skip them on the day of the tour." },
          ]} />
        </HelpSection>

        <HelpSection id="readiness" title="Readiness Checklist" icon={CheckCircle2}>
          <p className="text-muted-foreground mb-4">The Readiness tab summarizes the tour state and is the final step before publishing to mobile.</p>
          <FeatureList items={[
            { title: "Approval summary", desc: "Shows a count of Approved, Pending, Declined, and Missing Info stops. Aim for all stops to be Approved before publishing." },
            { title: "Estimated drive time", desc: "TourFlow estimates the total driving time between stops based on the route sequence. This is drive time only — add 30–45 minutes per stop for the showing itself." },
            { title: "Publish to Mobile", desc: "Tap the large blue button to publish the tour. This sends the full itinerary — stops, agent contacts, restriction notes, and sequence — to the mobile app." },
            { title: "Warning state", desc: "If any stops are still pending or missing agent info, a warning appears. You can still publish, but expect potential issues in the field." },
            { title: "Re-publishing", desc: "You can publish multiple times. Each publish overwrites the previous version on mobile with your latest changes." },
          ]} />
        </HelpSection>

        <HelpSection id="voice-notes" title="Voice Notes & Transcription" icon={Mic}>
          <p className="text-muted-foreground mb-4">Voice notes are recorded on the mobile app during the tour and automatically transcribed.</p>
          <FeatureList items={[
            { title: "Recording a note", desc: 'Open a stop on the mobile app, scroll to the Notes section, and tap "Record Note". Speak your observations, then tap Stop. The recording uploads automatically.' },
            { title: "Offline recording", desc: "If you're without cell service, recordings are saved locally and upload automatically when connectivity resumes." },
            { title: "Transcription", desc: "TourFlow sends audio to an AI transcription service. Within seconds, the text appears under the voice recording. If transcription fails, the raw audio is still preserved." },
            { title: "Typed notes", desc: "You can also type a note directly in the Notes text field if you prefer not to record audio." },
            { title: "AI Summary use", desc: "All voice transcripts and typed notes feed into the AI Tour Summary generated at the end of the tour." },
          ]} />
        </HelpSection>

        <HelpSection id="ai-summary" title="AI Tour Summary" icon={Bot}>
          <p className="text-muted-foreground mb-4">After visiting all stops, TourFlow uses AI to generate a structured tour summary.</p>
          <FeatureList items={[
            { title: "Generating the summary", desc: 'On the Tour Summary screen (accessed via the "Tour Summary" button in the action tray), tap "Generate AI Summary". This compiles all ratings, voice transcripts, quick tags, and flags from every stop.' },
            { title: "What is included", desc: "The summary includes overall tour highlights, per-property ratings and observations, and a recommended next-steps list based on buyer interest scores." },
            { title: "Sharing the summary", desc: "The summary is displayed as formatted text you can copy and paste into an email or CRM note for your buyer." },
            { title: "Regenerating", desc: "You can regenerate the summary at any time if you added more notes or changed ratings after the initial generation." },
            { title: "Provider configuration", desc: "Admins can configure which AI provider and model powers the summary from the AI Config page (visible to admin accounts only)." },
          ]} />
        </HelpSection>
      </div>
    </div>
  )
}

function HelpSection({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-border/50">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-foreground mb-3 mt-6">{children}</h3>
}

function FeatureList({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map(({ title, desc }) => (
        <li key={title} className="flex gap-3">
          <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium text-foreground">{title}</span>
            <span className="text-muted-foreground"> — {desc}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
