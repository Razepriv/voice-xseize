import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Mic,
  Volume2,
  Settings,
  Phone,
  Wrench,
  BarChart3,
  PhoneIncoming,
  Loader2,
  Plus
} from "lucide-react";

// AgentFormValues is now provided by the parent (AIAgents.tsx) via props, so we use 'any' for generic typing here
type AgentFormValues = any;

type BolnaModel = {
  id?: string;
  name?: string;
  model?: string;
  provider?: string;
  family?: string;
  description?: string;
};

type BolnaVoice = {
  id?: string;
  voice_id?: string;
  name?: string;
  voice_name?: string;
  provider?: string;
};

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<AgentFormValues>;
  onSubmit: (values: AgentFormValues) => void;
  mode: "create" | "edit";
  loading?: boolean;
  agentFormSchema: any;
  models: BolnaModel[];
  voices: BolnaVoice[];
  voiceProviders: string[];
  llmProviders: string[];
  transcriberProviders: string[];
  transcriberModels: Record<string, { value: string; label: string }[]>;
  phoneNumbers: { id: string; number: string }[];
  knowledgeBaseItems: { id: string; title: string }[];
}

export const AgentFormDialog: React.FC<AgentFormDialogProps> = ({
  open,
  onOpenChange,
  initialValues,
  onSubmit,
  mode,
  loading = false,
  agentFormSchema,
  models,
  voices,
  voiceProviders,
  llmProviders,
  transcriberProviders,
  transcriberModels,
  phoneNumbers,
  knowledgeBaseItems,
}) => {
  const [activeTab, setActiveTab] = useState("basic");

  // Local state for filtered options
  const [filteredModels, setFilteredModels] = useState<BolnaModel[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<BolnaVoice[]>([]);
  const [currentTranscriberModels, setCurrentTranscriberModels] = useState<{ value: string; label: string }[]>([]);

  // Debug logging
  useEffect(() => {
    if (open) {
      console.log("📊 AgentFormDialog Data:", {
        models: models.length,
        voices: voices.length,
        voiceProviders: voiceProviders.length,
        llmProviders: llmProviders.length,
        phoneNumbers: phoneNumbers.length,
        knowledgeBaseItems: knowledgeBaseItems.length
      });
      console.log("Models:", models);
      console.log("Voices:", voices);
      console.log("Voice Providers:", voiceProviders);
    }
  }, [open, models, voices, voiceProviders, llmProviders, phoneNumbers, knowledgeBaseItems]);

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      model: "gpt-4o-mini",
      language: "en-US",
      llmProvider: "openai",
      provider: voiceProviders.length > 0 ? voiceProviders[0] : "elevenlabs",
      transcriberProvider: "deepgram",
      transcriberModel: "nova-2",
      temperature: 0.7,
      maxDuration: 600,
      maxTokens: 150,
      hangupAfterSilence: 10,
      numberOfWordsForInterruption: 2,
      transcriberEndpointing: 100,
      incrementalDelay: 400,
      backchannelingMessageGap: 5,
      backchannelingStartDelay: 5,
      callTerminate: 90,
      webhookUrl: "https://platform.automitra.ai/api/webhooks/bolna/call-status",
      ...initialValues,
    },
    values: initialValues,
  });

  // Watch provider fields for filtering
  const watchedLlmProvider = form.watch("llmProvider");
  const watchedVoiceProvider = form.watch("provider");
  const watchedTranscriberProvider = form.watch("transcriberProvider");

  // Filter LLM models by provider
  useEffect(() => {
    if (!watchedLlmProvider) {
      setFilteredModels(models);
      return;
    }
    const filtered = models.filter(m => {
      const modelProvider = (m.provider || m.family || '').toLowerCase();
      return modelProvider === watchedLlmProvider.toLowerCase();
    });
    setFilteredModels(filtered.length > 0 ? filtered : models);

    // Auto-select first model if current selection is not in filtered list
    const currentModel = form.getValues("model");
    const currentInFiltered = filtered.some(m => (m.model || m.name) === currentModel);
    if (!currentInFiltered && filtered.length > 0) {
      form.setValue("model", filtered[0].model || filtered[0].name || "gpt-4o-mini");
    }
  }, [watchedLlmProvider, models, form]);

  // Filter voices by provider
  useEffect(() => {
    if (!watchedVoiceProvider || watchedVoiceProvider === 'all') {
      setFilteredVoices(voices);
      return;
    }
    const filtered = voices.filter(v => {
      const voiceProvider = (v.provider || '').toLowerCase();
      return voiceProvider === watchedVoiceProvider.toLowerCase();
    });
    setFilteredVoices(filtered);

    // Auto-select first voice if current selection is not in filtered list
    const currentVoiceId = form.getValues("voiceId");
    const currentInFiltered = filtered.some(v => (v.voice_id || v.id) === currentVoiceId);
    if (!currentInFiltered && filtered.length > 0) {
      const firstVoice = filtered[0];
      form.setValue("voiceId", firstVoice.voice_id || firstVoice.id || "");
      form.setValue("voiceName", firstVoice.voice_name || firstVoice.name || "");
    }
  }, [watchedVoiceProvider, voices, form]);

  // Update transcriber models by provider
  useEffect(() => {
    const provider = watchedTranscriberProvider || "deepgram";
    const providerModels = transcriberModels[provider] || transcriberModels.deepgram || [];
    setCurrentTranscriberModels(providerModels);

    // Auto-select first model if current selection is not valid
    const currentModel = form.getValues("transcriberModel");
    const currentValid = providerModels.some(m => m.value === currentModel);
    if (!currentValid && providerModels.length > 0) {
      form.setValue("transcriberModel", providerModels[0].value);
    }
  }, [watchedTranscriberProvider, transcriberModels, form]);

  // Initialize filtered lists when dialog opens
  useEffect(() => {
    if (open) {
      // Initialize with all models/voices, filtering will happen via watched values
      setFilteredModels(models);
      setFilteredVoices(voices);
      // Initialize transcriber models
      const provider = initialValues?.transcriberProvider || "deepgram";
      const providerModels = transcriberModels[provider] || transcriberModels.deepgram || [];
      setCurrentTranscriberModels(providerModels);
    }
  }, [open, models, voices, transcriberModels, initialValues?.transcriberProvider]);

  useEffect(() => {
    if (open && initialValues) {
      form.reset({
        name: "",
        description: "",
        model: "gpt-4o-mini",
        language: "en-US",
        llmProvider: "openai",
        provider: "elevenlabs",
        transcriberProvider: "deepgram",
        transcriberModel: "nova-2",
        temperature: 0.7,
        maxDuration: 600,
        maxTokens: 150,
        hangupAfterSilence: 10,
        numberOfWordsForInterruption: 2,
        transcriberEndpointing: 100,
        incrementalDelay: 400,
        backchannelingMessageGap: 5,
        backchannelingStartDelay: 5,
        callTerminate: 90,
        ...initialValues,
      });
      setActiveTab("basic");
    }
    // eslint-disable-next-line
  }, [open, initialValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Agent" : "Create Agent"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Update the agent configuration and settings." : "Configure your new AI agent with voice, model, and behavior settings."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.error("Form validation errors:", errors);
            // Find first error and show it
            const firstErrorKey = Object.keys(errors)[0];
            if (firstErrorKey) {
              const errorMessage = errors[firstErrorKey]?.message || `Invalid ${firstErrorKey}`;
              alert(`Validation Error: ${errorMessage}`);
            }
          })} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-8 h-auto">
                <TabsTrigger value="basic" className="flex items-center gap-1 text-xs py-2">
                  <FileText className="h-3 w-3" />
                  <span className="hidden sm:inline">Agent</span>
                </TabsTrigger>
                <TabsTrigger value="llm" className="flex items-center gap-1 text-xs py-2">
                  <Settings className="h-3 w-3" />
                  <span className="hidden sm:inline">LLM</span>
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-1 text-xs py-2">
                  <Volume2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Audio</span>
                </TabsTrigger>
                <TabsTrigger value="engine" className="flex items-center gap-1 text-xs py-2">
                  <Mic className="h-3 w-3" />
                  <span className="hidden sm:inline">Engine</span>
                </TabsTrigger>
                <TabsTrigger value="call" className="flex items-center gap-1 text-xs py-2">
                  <Phone className="h-3 w-3" />
                  <span className="hidden sm:inline">Call</span>
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center gap-1 text-xs py-2">
                  <Wrench className="h-3 w-3" />
                  <span className="hidden sm:inline">Tools</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs py-2">
                  <BarChart3 className="h-3 w-3" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="inbound" className="flex items-center gap-1 text-xs py-2">
                  <PhoneIncoming className="h-3 w-3" />
                  <span className="hidden sm:inline">Inbound</span>
                </TabsTrigger>
              </TabsList>

              {/* Agent Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>Core agent settings and identification</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter agent name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Brief description of the agent" rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="assignedPhoneNumberId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "_none_" ? "" : value)} value={field.value || "_none_"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Number" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_none_">Select Number</SelectItem>
                              {phoneNumbers.length === 0 ? (
                                <SelectItem value="_empty_" disabled>
                                  <span className="text-muted-foreground">No phone numbers available</span>
                                </SelectItem>
                              ) : (
                                phoneNumbers.map((n) => (
                                  <SelectItem key={n.id} value={n.id}>
                                    <span className="font-mono">{n.number}</span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {phoneNumbers.length === 0 ? "No phone numbers available. They will be synced automatically." : `Select a phone number for this agent (${phoneNumbers.length} available)`}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="knowledgeBaseIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Knowledge Base</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "_none_" ? [] : [value])} value={field.value?.[0] || "_none_"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select knowledge base" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_none_">None</SelectItem>
                              {knowledgeBaseItems.length === 0 ? (
                                <SelectItem value="_empty_" disabled>
                                  <span className="text-muted-foreground">No knowledge bases available</span>
                                </SelectItem>
                              ) : (
                                knowledgeBaseItems.map((kb) => (
                                  <SelectItem key={kb.id} value={kb.id}>
                                    {kb.title}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {knowledgeBaseItems.length === 0 ? "No knowledge bases available" : `Optional: Link a knowledge base to this agent (${knowledgeBaseItems.length} available)`}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Prompts & Messages</CardTitle>
                    <CardDescription>Define agent behavior and conversation flow</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="systemPrompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>System Prompt</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="System instructions for the agent" rows={4} />
                          </FormControl>
                          <FormDescription>
                            Define the agent's behavior and personality
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="userPrompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User Prompt</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="User context or instructions" rows={3} />
                          </FormControl>
                          <FormDescription>
                            Additional context for user interactions
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="firstMessage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Message</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Hello! How can I help you today?" rows={2} />
                          </FormControl>
                          <FormDescription>
                            The agent's opening message when call starts
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* LLM Tab */}
              <TabsContent value="llm" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Choose LLM Model</CardTitle>
                    <CardDescription>Configure the AI model settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="llmProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LLM Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "openai"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-zinc-950 border-input">
                                {llmProviders.map((provider) => (
                                  <SelectItem key={provider} value={provider} className="cursor-pointer">
                                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-zinc-950 border-input max-h-[300px]">
                                {filteredModels.length === 0 ? (
                                  <SelectItem value="_loading_" disabled>
                                    <div className="flex items-center gap-2">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Loading models...
                                    </div>
                                  </SelectItem>
                                ) : (
                                  filteredModels.map((m, idx) => (
                                    <SelectItem
                                      key={`${m.model || m.name || m.id}-${idx}`}
                                      value={m.model || m.name || "_unknown_"}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex flex-col text-left">
                                        <span className="font-medium">{m.model || m.name}</span>
                                        {m.description && (
                                          <span className="text-xs text-muted-foreground">{m.description}</span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose the language model ({filteredModels.length} available for {watchedLlmProvider || 'openai'})
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Model Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="maxTokens"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-2">
                              <FormLabel>Tokens generated on each LLM output</FormLabel>
                              <span className="text-sm font-semibold">{field.value || 150}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={50}
                                max={2000}
                                step={10}
                                value={[field.value || 150]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="w-full"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Increasing tokens enables longer responses to be queued for speech generation but increases latency
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="temperature"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-2">
                              <FormLabel>Temperature</FormLabel>
                              <span className="text-sm font-semibold">{field.value || 0.7}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0}
                                max={2}
                                step={0.1}
                                value={[field.value || 0.7]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="w-full"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Increasing temperature enables heightened creativity, but increases chance of deviation from prompt
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Advanced LLM Parameters */}
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="topP"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-2">
                              <FormLabel>Top P</FormLabel>
                              <span className="text-sm font-semibold">{field.value ?? 0.9}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={0}
                                max={1}
                                step={0.05}
                                value={[field.value ?? 0.9]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="w-full"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Nucleus sampling threshold
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="presencePenalty"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-2">
                              <FormLabel>Presence Penalty</FormLabel>
                              <span className="text-sm font-semibold">{field.value ?? 0}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={-2}
                                max={2}
                                step={0.1}
                                value={[field.value ?? 0]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="w-full"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Penalize new topics (-2 to 2)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="frequencyPenalty"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-2">
                              <FormLabel>Frequency Penalty</FormLabel>
                              <span className="text-sm font-semibold">{field.value ?? 0}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={-2}
                                max={2}
                                step={0.1}
                                value={[field.value ?? 0]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="w-full"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Penalize repetition (-2 to 2)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <FormField
                      control={form.control}
                      name="knowledgeBaseIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Add knowledge base (Multi-select)</FormLabel>
                          <Select onValueChange={(value) => {
                            const current = field.value || [];
                            if (value === "_none_") {
                              field.onChange([]);
                            } else if (current.includes(value)) {
                              field.onChange(current.filter((id: string) => id !== value));
                            } else {
                              field.onChange([...current, value]);
                            }
                          }} value={field.value?.[0] || "_none_"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select knowledge bases">
                                  {field.value && field.value.length > 0
                                    ? `${field.value.length} selected`
                                    : "Select knowledge bases"}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_none_">None</SelectItem>
                              {knowledgeBaseItems.length === 0 ? (
                                <SelectItem value="_empty_" disabled>
                                  <span className="text-muted-foreground">No knowledge bases available</span>
                                </SelectItem>
                              ) : (
                                knowledgeBaseItems.map((kb) => (
                                  <SelectItem key={kb.id} value={kb.id}>
                                    <div className="flex items-center gap-2">
                                      {field.value?.includes(kb.id) && <span>✓</span>}
                                      {kb.title}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {field.value && field.value.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {field.value.map((id: string) => {
                                const kb = knowledgeBaseItems.find(k => k.id === id);
                                return kb ? (
                                  <div key={id} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
                                    {kb.title}
                                    <button
                                      type="button"
                                      onClick={() => field.onChange(field.value.filter((kbId: string) => kbId !== id))}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          )}
                          <FormDescription>
                            {knowledgeBaseItems.length === 0 ? "No knowledge bases available" : `Select one or more knowledge bases (${knowledgeBaseItems.length} available)`}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FormLabel className="text-base">Add FAQs & Guardrail</FormLabel>
                        <a href="https://docs.bolna.ai" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                          DOCS ↗
                        </a>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          // TODO: Open FAQs & Guardrail dialog
                          alert("FAQs & Guardrail configuration coming soon!");
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add a new block for FAQs & Guardrails
                      </Button>
                      <FormDescription className="text-xs">
                        Define frequently asked questions and conversation guardrails
                      </FormDescription>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Audio Tab */}
              <TabsContent value="audio" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Voice & Audio Settings</CardTitle>
                    <CardDescription>Configure text-to-speech and audio parameters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voice Provider</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "elevenlabs"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-zinc-950 border-input">
                              {voiceProviders.length === 0 ? (
                                <SelectItem value="_loading_" disabled>
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading providers...
                                  </div>
                                </SelectItem>
                              ) : (
                                voiceProviders.map((p) => (
                                  <SelectItem key={p} value={p} className="cursor-pointer">
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select a voice provider to filter available voices
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* ElevenLabs Model Selector - Only show when provider is elevenlabs */}
                    {watchedVoiceProvider === "elevenlabs" && (
                      <FormField
                        control={form.control}
                        name="elevenlabsModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ElevenLabs Model</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "eleven_turbo_v2_5"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-zinc-950 border-input">
                                <SelectItem value="eleven_turbo_v2_5" className="cursor-pointer">
                                  <div className="flex flex-col text-left">
                                    <span className="font-medium">Eleven Turbo v2.5</span>
                                    <span className="text-xs text-muted-foreground">Fast, high quality - Recommended</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="eleven_flash_v2_5" className="cursor-pointer">
                                  <div className="flex flex-col text-left">
                                    <span className="font-medium">Eleven Flash v2.5</span>
                                    <span className="text-xs text-muted-foreground">Ultra-low latency</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="eleven_multilingual_v2" className="cursor-pointer">
                                  <div className="flex flex-col text-left">
                                    <span className="font-medium">Eleven Multilingual v2</span>
                                    <span className="text-xs text-muted-foreground">Best for non-English languages</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="eleven_monolingual_v1" className="cursor-pointer">
                                  <div className="flex flex-col text-left">
                                    <span className="font-medium">Eleven Monolingual v1</span>
                                    <span className="text-xs text-muted-foreground">Original English model</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Select the ElevenLabs voice synthesis model
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="voiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voice</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              if (value === "_none_") {
                                field.onChange("");
                                form.setValue("voiceName", "");
                              } else {
                                field.onChange(value);
                                // Find and set voice name
                                const selectedVoice = filteredVoices.find(v => (v.voice_id || v.id) === value);
                                if (selectedVoice) {
                                  form.setValue("voiceName", selectedVoice.voice_name || selectedVoice.name || "");
                                }
                              }
                            }}
                            value={field.value || "_none_"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Voice" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px] bg-white dark:bg-zinc-950 border-input">
                              <SelectItem value="_none_">Select Voice</SelectItem>
                              {filteredVoices.length === 0 ? (
                                <SelectItem value="_loading_" disabled>
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {voices.length === 0 ? "Loading voices..." : "No voices available for this provider"}
                                  </div>
                                </SelectItem>
                              ) : (
                                filteredVoices.map((v, idx) => (
                                  <SelectItem
                                    key={`${v.voice_id || v.id || 'voice'}-${idx}`}
                                    value={v.voice_id || v.id || `_unknown_${idx}`}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col text-left">
                                      <span className="font-medium text-foreground">{v.voice_name || v.name || "Unknown Voice"}</span>
                                      {v.provider && <span className="text-xs text-muted-foreground">{v.provider}</span>}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the voice for your AI agent ({filteredVoices.length} voices available for {watchedVoiceProvider || 'all providers'})
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="en-US">English (US)</SelectItem>
                              <SelectItem value="en-GB">English (GB)</SelectItem>
                              <SelectItem value="es-ES">Spanish</SelectItem>
                              <SelectItem value="fr-FR">French</SelectItem>
                              <SelectItem value="de-DE">German</SelectItem>
                              <SelectItem value="hi-IN">Hindi</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="synthesizerStream"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Stream Audio</FormLabel>
                            <FormDescription>
                              Enable real-time audio streaming
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="synthesizerBufferSize"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Buffer Size</FormLabel>
                            <span className="text-sm text-muted-foreground">{field.value || 400}</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={50}
                              max={500}
                              step={50}
                              value={[field.value || 400]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Audio buffer size in milliseconds
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="speedRate"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Speed Rate</FormLabel>
                            <span className="text-sm text-muted-foreground">{field.value || 1.0}</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={0.5}
                              max={2.0}
                              step={0.1}
                              value={[field.value || 1.0]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Speech speed (0.5 = slow, 1.0 = normal, 2.0 = fast)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="similarityBoost"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Similarity Boost</FormLabel>
                            <span className="text-sm text-muted-foreground">{field.value || 0.75}</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={0}
                              max={1}
                              step={0.05}
                              value={[field.value || 0.75]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Voice consistency (0 = varied, 1 = highly consistent)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stability"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Stability</FormLabel>
                            <span className="text-sm text-muted-foreground">{field.value || 0.5}</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={0}
                              max={1}
                              step={0.05}
                              value={[field.value || 0.5]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Voice stability (0 = expressive, 1 = stable)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="styleExaggeration"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Style Exaggeration</FormLabel>
                            <span className="text-sm text-muted-foreground">{field.value || 0}</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={0}
                              max={1}
                              step={0.05}
                              value={[field.value || 0]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Style intensity (0 = neutral, 1 = highly styled)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Engine Tab - Transcription & Interruptions */}
              <TabsContent value="engine" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Transcription & Interruptions</CardTitle>
                    <CardDescription>Control how speech is captured and processed</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">Transcription Settings</h4>

                      <FormField
                        control={form.control}
                        name="transcriberProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transcriber Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "deepgram"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-zinc-950 border-input">
                                {transcriberProviders.map((provider) => (
                                  <SelectItem key={provider} value={provider} className="cursor-pointer">
                                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="transcriberModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transcriber Model</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "nova-2"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-zinc-950 border-input">
                                {currentTranscriberModels.length === 0 ? (
                                  <SelectItem value="_loading_" disabled>
                                    <div className="flex items-center gap-2">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Loading models...
                                    </div>
                                  </SelectItem>
                                ) : (
                                  currentTranscriberModels.map((model) => (
                                    <SelectItem key={model.value} value={model.value} className="cursor-pointer">
                                      {model.label}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Model variant for transcription ({currentTranscriberModels.length} available for {watchedTranscriberProvider || 'deepgram'})
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="transcriberEndpointing"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Endpointing (ms)</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value || 100}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={50}
                                max={500}
                                step={50}
                                value={[field.value || 100]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Wait time before generating response
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">Interruption Handling</h4>

                      <FormField
                        control={form.control}
                        name="numberOfWordsForInterruption"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Words Before Interrupting</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value || 2}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={1}
                                max={10}
                                step={1}
                                value={[field.value || 2]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Agent will not consider interruptions until this many words are spoken
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="incrementalDelay"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Linear Delay (ms)</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value || 400}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={100}
                                max={1000}
                                step={100}
                                value={[field.value || 400]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Linear delay accounts for long pauses mid-sentence
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Response Latency</CardTitle>
                    <CardDescription>Configure agent response timing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="responseRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Response Rate</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "custom"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select rate" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="fast">Fast</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="slow">Slow</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Call Tab */}
              <TabsContent value="call" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Call Management</CardTitle>
                    <CardDescription>Configure call behavior and termination</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">Telephony Features</h4>

                      <FormField
                        control={form.control}
                        name="noiseCancellation"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Noise Cancellation</FormLabel>
                              <FormDescription>
                                Filter background noise for clearer audio
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voicemailDetection"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Voicemail Detection</FormLabel>
                              <FormDescription>
                                Detect and handle voicemail systems
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="keypadInput"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Keypad Input (DTMF)</FormLabel>
                              <FormDescription>
                                Enable touch-tone keypad input during calls
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="autoReschedule"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Auto Reschedule</FormLabel>
                              <FormDescription>
                                Automatically reschedule failed calls
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ambientNoise"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Ambient Noise</FormLabel>
                              <FormDescription>
                                Add background ambiance to make calls feel more natural
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch("ambientNoise") && (
                        <FormField
                          control={form.control}
                          name="ambientNoiseTrack"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ambient Noise Track</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || "office-ambience"}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select ambient sound" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-white dark:bg-zinc-950 border-input">
                                  <SelectItem value="office-ambience">Office Ambience</SelectItem>
                                  <SelectItem value="cafe-ambience">Cafe Ambience</SelectItem>
                                  <SelectItem value="call-center">Call Center</SelectItem>
                                  <SelectItem value="outdoor">Outdoor</SelectItem>
                                  <SelectItem value="white-noise">White Noise</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Choose the background sound for calls
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="finalCallMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Final Call Message</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Thank you for your time. Goodbye!" rows={2} />
                            </FormControl>
                            <FormDescription>
                              Last message before call disconnects
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">Call Duration & Timeouts</h4>

                      <FormField
                        control={form.control}
                        name="maxDuration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Call Duration (seconds)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="30" max="3600" />
                            </FormControl>
                            <FormDescription>
                              Maximum length of a call in seconds
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hangupAfterSilence"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Hangup After Silence (seconds)</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value || 10}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={5}
                                max={60}
                                step={5}
                                value={[field.value || 10]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Auto-hangup after silence duration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="callTerminate"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Call Terminate (seconds)</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value || 90}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={30}
                                max={300}
                                step={10}
                                value={[field.value || 90]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum time before forced termination
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hangupAfterLLMCall"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Hangup After LLM Call</FormLabel>
                              <FormDescription>
                                Automatically end call after agent response
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voicemail"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Voicemail</FormLabel>
                              <FormDescription>
                                Leave voicemail if call goes unanswered
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="callCancellationPrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Call Cancellation Prompt</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Message when call is cancelled" rows={2} />
                            </FormControl>
                            <FormDescription>
                              Optional message to play when cancelling
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Online Detection</CardTitle>
                    <CardDescription>Check if user is still on the call</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="backchannelingEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Backchanneling</FormLabel>
                            <FormDescription>
                              Check if user is still on the call with periodic messages
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="backchannelingMessageGap"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Invoke Message After (seconds)</FormLabel>
                            <span className="text-sm text-muted-foreground">{field.value || 5}</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={3}
                              max={30}
                              step={1}
                              value={[field.value || 5]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Time interval for detection messages
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="backchannelingStartDelay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detection Message</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Hey, are you still there?" />
                          </FormControl>
                          <FormDescription>
                            Message to check if user is still listening
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tools Tab */}
              <TabsContent value="tools" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Agent Tools & Functions</CardTitle>
                    <CardDescription>Configure agent capabilities and integrations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="toolsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Tools</FormLabel>
                            <FormDescription>
                              Allow agent to use external functions and APIs
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                      <p>Tools integration allows your agent to:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Make API calls</li>
                        <li>Query databases</li>
                        <li>Access external systems</li>
                        <li>Execute custom functions</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Analytics & Monitoring</CardTitle>
                    <CardDescription>Configure data collection and reporting</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="analyticsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Analytics</FormLabel>
                            <FormDescription>
                              Collect call metrics and conversation data
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value !== false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="webhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook URL (Pre-configured)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled
                              placeholder="https://platform.automitra.ai/api/webhooks/bolna/call-status"
                            />
                          </FormControl>
                          <FormDescription>
                            Webhook URL is automatically configured for real-time updates
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                      <p>Analytics provides insights into:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Call duration and outcomes</li>
                        <li>Conversation quality metrics</li>
                        <li>Agent performance statistics</li>
                        <li>User satisfaction indicators</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Inbound Tab */}
              <TabsContent value="inbound" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Inbound Call Settings</CardTitle>
                    <CardDescription>Configure how agent handles incoming calls</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="inboundEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Accept Inbound Calls</FormLabel>
                            <FormDescription>
                              Allow this agent to receive incoming calls
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="disallowUnknownNumbers"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Block Unknown Numbers</FormLabel>
                            <FormDescription>
                              Only accept calls from known contacts
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="callForwardingEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Call Forwarding</FormLabel>
                            <FormDescription>
                              Forward calls to another number if needed
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="callForwardingNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forward To Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+1234567890" type="tel" />
                          </FormControl>
                          <FormDescription>
                            Phone number to forward calls to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Agent"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export type { AgentFormValues };