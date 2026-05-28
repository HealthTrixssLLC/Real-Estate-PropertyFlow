---
name: TourFlow visited semantics
description: When and how a tour_stop becomes "visited", and what Generate Profile actually requires.
---

User mental model: "I added a note → I was there." Code must match this or users hit a dead-end where stops have notes but Generate Profile stays disabled.

Rule: any audio capture for a stop should mark the stop visited.
- Debrief upload → mark visited immediately on upload (synchronous; debrief route).
- Regular voice note → mark visited when transcription completes (background job in voiceNotes runTranscriptionJob), because the upload itself isn't proof until we have text. Use an atomic conditional update (`WHERE id = ? AND visited = false`) to avoid races between concurrent transcriptions for the same stop. Set arrival_time via `COALESCE(arrival_time, NOW())` so manual arrival times are preserved.

**Why:** Before this, only debrief uploads marked visited, and Generate Profile required both `visited` AND a debrief transcript/summary. Users adding regular voice notes during a walkthrough saw stops stay unvisited and the Generate Profile button stay disabled with no obvious path forward.

**How to apply:** Generate Profile gating (web BuyerDetail) is now `stop.visited && !stop.skipped` — do not re-add a debrief requirement. The server profile-generation route blends voice-note `typedNote` text into the same "debrief" field passed to the AI prompt, so voice notes count as showing evidence. If you add a new audio-capture surface (e.g. dictation, walkthrough comments), apply the same auto-visit rule there.
