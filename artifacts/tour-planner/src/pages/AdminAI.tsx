import { useGetAiConfig, useGetAiHealth, useSaveAiConfig, useTestAiConfig, useTestGoogleMapsConfig } from "@workspace/api-client-react"
import {
  SaveAiConfigRequestTranscriptionProvider,
  SaveAiConfigRequestSummarizationProvider,
} from "@workspace/api-client-react"
import { Bot, CheckCircle2, XCircle, Loader2, Save, Activity, Settings2, Globe, Mic, Cpu, MapPin, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function AdminAI() {
  const { data: configData, isLoading: configLoading, refetch } = useGetAiConfig()
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useGetAiHealth()
  const saveConfig = useSaveAiConfig()
  const testConfig = useTestAiConfig()
  const testGoogleMaps = useTestGoogleMapsConfig()
  const { toast } = useToast()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [healthRefreshing, setHealthRefreshing] = useState(false)
  const [googleMapsTestResult, setGoogleMapsTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showGoogleMapsKey, setShowGoogleMapsKey] = useState(false)
  const [googleMapsKeyInput, setGoogleMapsKeyInput] = useState("")

  const c = configData?.config

  const handleSaveToggles = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const txProvider = fd.get("tx_provider") as SaveAiConfigRequestTranscriptionProvider
    const sumProvider = fd.get("sum_provider") as SaveAiConfigRequestSummarizationProvider
    try {
      await saveConfig.mutateAsync({
        data: {
          transcriptionEnabled: fd.get("tx_enabled") === "on",
          transcriptionProvider: txProvider,
          summarizationEnabled: fd.get("sum_enabled") === "on",
          summarizationProvider: sumProvider,
          draftingEnabled: fd.get("draft_enabled") === "on",
          patternAnalysisEnabled: fd.get("pattern_enabled") === "on",
        },
      })
      toast({ title: "Feature settings saved" })
      refetch()
    } catch {
      toast({ title: "Failed to save feature settings", variant: "destructive" })
    }
  }

  const handleSaveEndpoints = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await saveConfig.mutateAsync({
        data: {
          transcriptionEnabled: c?.transcription?.enabled ?? false,
          transcriptionProvider: (c?.transcription?.provider as SaveAiConfigRequestTranscriptionProvider) || SaveAiConfigRequestTranscriptionProvider.azure_whisper,
          summarizationEnabled: c?.summarization?.enabled ?? false,
          summarizationProvider: (c?.summarization?.provider as SaveAiConfigRequestSummarizationProvider) || SaveAiConfigRequestSummarizationProvider.azure_openai,
          draftingEnabled: c?.drafting?.enabled ?? false,
          patternAnalysisEnabled: c?.patternAnalysis?.enabled ?? false,
          azureOpenAiBaseUrl: (fd.get("azure_openai_base_url") as string) || undefined,
          azureOpenAiModel: (fd.get("azure_openai_model") as string) || undefined,
          azureOpenAiWhisperDeployment: (fd.get("azure_openai_whisper_deployment") as string) || undefined,
          azureSpeechRegion: (fd.get("azure_speech_region") as string) || undefined,
        },
      })
      toast({ title: "Endpoint configuration saved" })
      refetch()
    } catch {
      toast({ title: "Failed to save endpoints", variant: "destructive" })
    }
  }

  const handleSaveGoogleMaps = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!googleMapsKeyInput.trim()) return
    try {
      await saveConfig.mutateAsync({
        data: { googleMapsApiKey: googleMapsKeyInput.trim() },
      })
      toast({ title: "Google Maps API key saved" })
      setGoogleMapsKeyInput("")
      refetch()
    } catch {
      toast({ title: "Failed to save Google Maps API key", variant: "destructive" })
    }
  }

  const runGoogleMapsTest = async () => {
    setGoogleMapsTestResult(null)
    try {
      const res = await testGoogleMaps.mutateAsync({ data: { apiKey: googleMapsKeyInput.trim() || undefined } })
      if (res.success) {
        setGoogleMapsTestResult({ ok: true, message: res.result ?? "Key is valid." })
        toast({ title: "Google Maps test passed" })
      } else {
        setGoogleMapsTestResult({ ok: false, message: res.error ?? "Unknown error" })
        toast({ title: "Google Maps test failed", description: res.error ?? undefined, variant: "destructive" })
      }
    } catch {
      toast({ title: "Test request failed", variant: "destructive" })
    }
  }

  const runTest = async () => {
    setTestResult(null)
    try {
      const res = await testConfig.mutateAsync({ data: { feature: "summarization" } })
      if (res.success) {
        toast({ title: "Test successful", description: "AI provider connected." })
        setTestResult(res.result || "Success")
      } else {
        toast({ title: "Test failed", description: res.error, variant: "destructive" })
        setTestResult(`Error: ${res.error}`)
      }
    } catch {
      toast({ title: "Test request failed", variant: "destructive" })
    }
  }

  const handleRefreshHealth = async () => {
    setHealthRefreshing(true)
    await refetchHealth()
    setHealthRefreshing(false)
  }

  if (configLoading || healthLoading) return (
    <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  )

  const h = healthData?.providers

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Services Configuration</h1>
        <p className="text-muted-foreground mt-1">Manage AI providers, endpoints, and feature flags.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Feature Toggles & Providers
              </CardTitle>
              <CardDescription>Enable or disable specific AI capabilities and select providers</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form id="ai-config-form" onSubmit={handleSaveToggles} className="space-y-4">

                <div className="grid grid-cols-[1fr_auto_200px] gap-4 items-center p-4 bg-background rounded-lg border">
                  <div>
                    <Label className="text-base font-semibold">Voice Transcription</Label>
                    <p className="text-sm text-muted-foreground">Convert audio notes to text</p>
                  </div>
                  <Switch name="tx_enabled" defaultChecked={c?.transcription?.enabled} />
                  <Select name="tx_provider" defaultValue={c?.transcription?.provider || SaveAiConfigRequestTranscriptionProvider.azure_whisper}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SaveAiConfigRequestTranscriptionProvider.azure_whisper}>Azure OpenAI Whisper</SelectItem>
                      <SelectItem value={SaveAiConfigRequestTranscriptionProvider.azure_speech}>Azure Speech</SelectItem>
                      <SelectItem value={SaveAiConfigRequestTranscriptionProvider.openai}>OpenAI Whisper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-[1fr_auto_200px] gap-4 items-center p-4 bg-background rounded-lg border">
                  <div>
                    <Label className="text-base font-semibold">Tour Summarization</Label>
                    <p className="text-sm text-muted-foreground">Generate end-of-tour buyer reports</p>
                  </div>
                  <Switch name="sum_enabled" defaultChecked={c?.summarization?.enabled} />
                  <Select name="sum_provider" defaultValue={c?.summarization?.provider || SaveAiConfigRequestSummarizationProvider.azure_openai}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SaveAiConfigRequestSummarizationProvider.azure_openai}>Azure OpenAI</SelectItem>
                      <SelectItem value={SaveAiConfigRequestSummarizationProvider.openai}>OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-8 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Switch name="draft_enabled" defaultChecked={c?.drafting?.enabled} id="draft" />
                    <Label htmlFor="draft">Auto-draft Showing Requests</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch name="pattern_enabled" defaultChecked={c?.patternAnalysis?.enabled} id="pattern" />
                    <Label htmlFor="pattern">Buyer Pattern Analysis</Label>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <Button type="submit" form="ai-config-form" disabled={saveConfig.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saveConfig.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                API Endpoints & Configuration
              </CardTitle>
              <CardDescription>Configure deployment-specific endpoints and model identifiers</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveEndpoints} className="space-y-6">

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Azure OpenAI (Text Generation)</span>
                    {c?.azureOpenAiConfigured
                      ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 ml-auto">Configured</Badge>
                      : <Badge variant="outline" className="text-muted-foreground ml-auto">Not Set</Badge>
                    }
                  </div>
                  {c?.azureOpenAiBaseUrl && (
                    <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded border truncate">
                      {c.azureOpenAiBaseUrl}
                    </p>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="azure_openai_base_url" className="text-xs">Base URL</Label>
                    <Input
                      id="azure_openai_base_url"
                      name="azure_openai_base_url"
                      type="url"
                      placeholder={c?.azureOpenAiConfigured ? "Leave blank to keep current value" : "https://<resource>.cognitiveservices.azure.com/"}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="azure_openai_model" className="text-xs">
                      Model / Deployment Name
                      {c?.azureOpenAiModel && (
                        <span className="ml-2 text-muted-foreground font-mono">current: {c.azureOpenAiModel}</span>
                      )}
                    </Label>
                    <Input
                      id="azure_openai_model"
                      name="azure_openai_model"
                      placeholder={c?.azureOpenAiModel ?? "gpt-4o"}
                    />
                    <p className="text-xs text-muted-foreground">Set AZURE_OPENAI_MODEL in environment secrets.</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Azure OpenAI Whisper (Transcription)</span>
                    {c?.azureWhisperConfigured
                      ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 ml-auto">Configured</Badge>
                      : <Badge variant="outline" className="text-muted-foreground ml-auto">Not Set</Badge>
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">Uses the same Azure resource and API key as text generation. Only the deployment name differs.</p>
                  <div className="space-y-1">
                    <Label htmlFor="azure_openai_whisper_deployment" className="text-xs">
                      Whisper Deployment Name
                      {c?.azureWhisperDeployment && (
                        <span className="ml-2 text-muted-foreground font-mono">current: {c.azureWhisperDeployment}</span>
                      )}
                    </Label>
                    <Input
                      id="azure_openai_whisper_deployment"
                      name="azure_openai_whisper_deployment"
                      placeholder={c?.azureWhisperDeployment ?? "whisper"}
                    />
                    <p className="text-xs text-muted-foreground">Set AZURE_OPENAI_WHISPER_DEPLOYMENT in environment secrets.</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm text-muted-foreground">Azure Speech Services (Legacy)</span>
                    {c?.azureSpeechConfigured
                      ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 ml-auto">Configured</Badge>
                      : <Badge variant="outline" className="text-muted-foreground ml-auto">Not Set</Badge>
                    }
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="azure_speech_region" className="text-xs">Region</Label>
                    <Input
                      id="azure_speech_region"
                      name="azure_speech_region"
                      placeholder={c?.azureSpeechConfigured ? "Leave blank to keep current value" : "eastus"}
                    />
                    <p className="text-xs text-muted-foreground">Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in environment secrets.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <Button type="submit" disabled={saveConfig.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saveConfig.isPending ? "Saving..." : "Save Endpoints"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Google Maps
              </CardTitle>
              <CardDescription>Enter your Google Maps API key for address autocomplete and route optimization</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveGoogleMaps} className="space-y-4">
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Maps &amp; Places API</span>
                    {c?.googleMapsConfigured
                      ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 ml-auto">Configured</Badge>
                      : <Badge variant="outline" className="text-muted-foreground ml-auto">Not Set</Badge>
                    }
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="google_maps_api_key" className="text-xs">API Key</Label>
                    <div className="relative">
                      <Input
                        id="google_maps_api_key"
                        type={showGoogleMapsKey ? "text" : "password"}
                        placeholder={c?.googleMapsConfigured ? "Leave blank to keep current key" : "AIza..."}
                        value={googleMapsKeyInput}
                        onChange={(e) => setGoogleMapsKeyInput(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleMapsKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showGoogleMapsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Requires the Geocoding API and Places API to be enabled in your Google Cloud project.</p>
                  </div>
                </div>

                {googleMapsTestResult && (
                  <div className={cn(
                    "flex items-start gap-2 p-3 rounded-lg border text-sm",
                    googleMapsTestResult.ok
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  )}>
                    {googleMapsTestResult.ok
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    }
                    <span>{googleMapsTestResult.message}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={runGoogleMapsTest}
                    disabled={testGoogleMaps.isPending}
                    className="gap-2"
                  >
                    {testGoogleMaps.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Test Key
                  </Button>
                  <Button type="submit" disabled={saveConfig.isPending || !googleMapsKeyInput.trim()} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saveConfig.isPending ? "Saving..." : "Save Key"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Run a quick generation test using the current Summarization provider to verify API keys and network connectivity.</p>
              <Button variant="secondary" onClick={runTest} disabled={testConfig.isPending}>
                {testConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Run Test Prompt
              </Button>
              {testResult && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm font-mono whitespace-pre-wrap border border-border">
                  {testResult}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-primary" />
                  Provider Health
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleRefreshHealth} disabled={healthRefreshing} className="h-7 px-2 text-xs">
                  {healthRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <HealthRow name="Azure OpenAI (GPT)" subtitle={c?.azureOpenAiModel ?? undefined} ok={h?.azure_openai?.healthy} error={h?.azure_openai?.error} />
              <HealthRow name="Azure OpenAI Whisper" subtitle={c?.azureWhisperDeployment ?? undefined} ok={h?.azure_whisper?.healthy} error={h?.azure_whisper?.error} />
              <HealthRow name="Azure Speech" ok={h?.azure_speech?.healthy} error={h?.azure_speech?.error} />
              <HealthRow name="OpenAI" ok={h?.openai?.healthy} error={h?.openai?.error} />

              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Env Variables</p>
                <div className="space-y-1.5">
                  <EnvBadge name="AZURE_OPENAI_API_KEY" ok={c?.azureWhisperConfigured} />
                  <EnvBadge name="AZURE_OPENAI_BASE_URL" ok={c?.azureWhisperConfigured} />
                  <EnvBadge name="AZURE_OPENAI_MODEL" ok={c?.azureOpenAiConfigured} />
                  <EnvBadge name="AZURE_OPENAI_WHISPER_DEPLOYMENT" ok={c?.azureWhisperConfigured} value={c?.azureWhisperDeployment} />
                  <EnvBadge name="AZURE_SPEECH_KEY" ok={c?.azureSpeechConfigured} />
                  <EnvBadge name="OPENAI_API_KEY" ok={c?.openAiConfigured} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transcription</span>
                <ProviderBadge provider={c?.transcription?.provider} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Summarization</span>
                <ProviderBadge provider={c?.summarization?.provider} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drafting</span>
                <ProviderBadge provider={c?.drafting?.provider} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Analysis</span>
                <ProviderBadge provider={c?.patternAnalysis?.provider} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function HealthRow({ name, subtitle, ok, error }: { name: string; subtitle?: string; ok?: boolean; error?: string | null }) {
  return (
    <div className="flex items-start justify-between p-3 bg-background rounded-lg border shadow-sm">
      <div className="min-w-0">
        <div className="font-medium text-sm">{name}</div>
        {subtitle && <div className="text-xs text-muted-foreground font-mono">{subtitle}</div>}
        {error && <div className="text-xs text-destructive mt-1 break-all">{error}</div>}
      </div>
      <div className="ml-2 shrink-0">
        {ok ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground/30" />}
      </div>
    </div>
  )
}

function EnvBadge({ name, ok, value }: { name: string; ok?: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between text-xs font-mono p-1.5 bg-background rounded border">
      <div className="min-w-0">
        <span className="text-muted-foreground truncate block">{name}</span>
        {value && <span className="text-primary/70 truncate block">{value}</span>}
      </div>
      <div className={cn("h-2 w-2 rounded-full shrink-0 ml-1", ok ? "bg-green-500" : "bg-destructive/50")} />
    </div>
  )
}

function ProviderBadge({ provider }: { provider?: string }) {
  const labels: Record<string, string> = {
    azure_whisper: "Azure Whisper",
    azure_openai: "Azure OpenAI",
    azure_speech: "Azure Speech",
    openai: "OpenAI",
  }
  return (
    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
      {provider ? (labels[provider] ?? provider) : "—"}
    </span>
  )
}
