import { useGetAiConfig, useGetAiHealth, useSaveAiConfig, useTestAiConfig } from "@workspace/api-client-react"
import {
  SaveAiConfigRequestTranscriptionProvider,
  SaveAiConfigRequestSummarizationProvider,
} from "@workspace/api-client-react"
import { Bot, CheckCircle2, XCircle, Loader2, Save, Activity, Settings2, Globe } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function AdminAI() {
  const { data: configData, isLoading: configLoading, refetch } = useGetAiConfig()
  const { data: healthData, isLoading: healthLoading } = useGetAiHealth()
  const saveConfig = useSaveAiConfig()
  const testConfig = useTestAiConfig()
  const { toast } = useToast()
  const [testResult, setTestResult] = useState<string | null>(null)

  const c = configData?.config

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
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
          azureOpenAiBaseUrl: (fd.get("azure_openai_base_url") as string) || undefined,
          azureOpenAiModel: (fd.get("azure_openai_model") as string) || undefined,
          azureSpeechRegion: (fd.get("azure_speech_region") as string) || undefined,
        }
      })
      toast({ title: "Configuration saved successfully" })
      refetch()
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" })
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
              <form id="ai-config-form" onSubmit={handleSave} className="space-y-6">

                <div className="grid grid-cols-[1fr_auto_200px] gap-4 items-center p-4 bg-background rounded-lg border">
                  <div>
                    <Label className="text-base font-semibold">Voice Transcription</Label>
                    <p className="text-sm text-muted-foreground">Convert audio notes to text</p>
                  </div>
                  <Switch name="tx_enabled" defaultChecked={c?.transcription?.enabled} />
                  <Select name="tx_provider" defaultValue={c?.transcription?.provider || SaveAiConfigRequestTranscriptionProvider.azure_speech}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
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

                <div className="flex justify-end pt-4 border-t">
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
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="azure_openai_base_url" className="text-sm font-semibold">Azure OpenAI Base URL</Label>
                  <Input
                    id="azure_openai_base_url"
                    name="azure_openai_base_url"
                    type="url"
                    placeholder="https://<resource>.openai.azure.com/"
                    defaultValue=""
                  />
                  <p className="text-xs text-muted-foreground">Your Azure OpenAI resource endpoint. Set AZURE_OPENAI_BASE_URL in environment secrets to configure.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="azure_openai_model" className="text-sm font-semibold">Azure OpenAI Deployment Name</Label>
                  <Input
                    id="azure_openai_model"
                    name="azure_openai_model"
                    placeholder="gpt-4o"
                    defaultValue=""
                  />
                  <p className="text-xs text-muted-foreground">The deployment model name (e.g. gpt-4o, gpt-35-turbo). Set AZURE_OPENAI_MODEL in environment secrets.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="azure_speech_region" className="text-sm font-semibold">Azure Speech Region</Label>
                  <Input
                    id="azure_speech_region"
                    name="azure_speech_region"
                    placeholder="eastus"
                    defaultValue=""
                  />
                  <p className="text-xs text-muted-foreground">Azure Speech Services region (e.g. eastus, westus2). Set AZURE_SPEECH_REGION in environment secrets.</p>
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
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Provider Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <HealthRow name="Azure OpenAI" ok={h?.azure_openai?.healthy} error={h?.azure_openai?.error} />
              <HealthRow name="Azure Speech" ok={h?.azure_speech?.healthy} error={h?.azure_speech?.error} />
              <HealthRow name="OpenAI" ok={h?.openai?.healthy} error={h?.openai?.error} />

              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Env Status</p>
                <div className="space-y-2">
                  <EnvBadge name="AZURE_OPENAI_API_KEY" ok={c?.azureOpenAiConfigured} />
                  <EnvBadge name="AZURE_OPENAI_BASE_URL" ok={c?.azureOpenAiConfigured} />
                  <EnvBadge name="AZURE_SPEECH_KEY" ok={c?.azureSpeechConfigured} />
                  <EnvBadge name="OPENAI_API_KEY" ok={c?.openAiConfigured} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function HealthRow({ name, ok, error }: { name: string; ok?: boolean; error?: string | null }) {
  return (
    <div className="flex items-start justify-between p-3 bg-background rounded-lg border shadow-sm">
      <div>
        <div className="font-medium text-sm">{name}</div>
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      </div>
      {ok ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground/30" />}
    </div>
  )
}

function EnvBadge({ name, ok }: { name: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs font-mono p-1.5 bg-background rounded border">
      <span className="text-muted-foreground">{name}</span>
      <div className={cn("h-2 w-2 rounded-full", ok ? "bg-green-500" : "bg-destructive/50")} />
    </div>
  )
}
