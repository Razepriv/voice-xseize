import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AgentFormDialog } from "@/components/AgentFormDialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bot, Phone, PhoneIncoming, PhoneOff, Plus, Settings, Zap, Loader2, BookOpen, Mic, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import type { AiAgent, KnowledgeBase as KnowledgeBaseType, PhoneNumber } from "@shared/schema";
import { createAiAgentSchema } from "@shared/schema";
import { z } from "zod";

type BolnaVoice = {
  id?: string;
  voice_id?: string;
  name?: string;
  voice_name?: string;
  provider?: string;
};

type BolnaModel = {
  id?: string;
  name?: string;
  model?: string;
  provider?: string;
  family?: string;
  description?: string;
};

// Provider-specific model configurations based on Bolna API documentation
const LLM_PROVIDERS = ['openai', 'anthropic', 'groq', 'together', 'anyscale', 'deepinfra', 'fireworks', 'azure'] as const;
const VOICE_PROVIDERS = ['elevenlabs', 'polly', 'deepgram', 'azuretts', 'rime', 'cartesia', 'sarvam', 'smallest', 'playht', 'xtts', 'inworld'] as const;
const TRANSCRIBER_PROVIDERS = ['deepgram', 'azure', 'google', 'bodhi'] as const;

// Transcriber models by provider
const TRANSCRIBER_MODELS: Record<string, { value: string; label: string }[]> = {
  deepgram: [
    { value: 'nova-3', label: 'Nova 3 (Latest)' },
    { value: 'nova-2', label: 'Nova 2' },
    { value: 'nova-2-meeting', label: 'Nova 2 Meeting' },
    { value: 'nova-2-phonecall', label: 'Nova 2 Phone Call' },
    { value: 'nova-2-finance', label: 'Nova 2 Finance' },
    { value: 'nova-2-conversationalai', label: 'Nova 2 Conversational AI' },
    { value: 'nova-2-medical', label: 'Nova 2 Medical' },
    { value: 'nova-2-drivethru', label: 'Nova 2 Drive-Thru' },
    { value: 'nova-2-automotive', label: 'Nova 2 Automotive' },
  ],
  bodhi: [
    { value: 'hi-general-v2-8khz', label: 'Hindi General v2' },
    { value: 'kn-general-v2-8khz', label: 'Kannada General v2' },
    { value: 'mr-general-v2-8khz', label: 'Marathi General v2' },
    { value: 'ta-general-v2-8khz', label: 'Tamil General v2' },
    { value: 'bn-general-v2-8khz', label: 'Bengali General v2' },
  ],
  azure: [
    { value: 'whisper', label: 'Whisper' },
    { value: 'whisper-large', label: 'Whisper Large' },
  ],
  google: [
    { value: 'latest_short', label: 'Latest Short' },
    { value: 'latest_long', label: 'Latest Long' },
    { value: 'telephony', label: 'Telephony' },
  ],
};

// Form schema with numeric coercion - extends shared schema for alignment
// z.coerce handles HTML number input strings → numbers automatically
const agentFormSchema = createAiAgentSchema.extend({
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  maxDuration: z.coerce.number().int().positive().default(600),
  maxTokens: z.coerce.number().int().positive().default(150),

  // Advanced Bolna Config Fields
  webhookUrl: z.string().optional(),
  agentType: z.string().default("other"),

  // LLM Provider (separate from voice provider)
  llmProvider: z.string().default("openai"),

  // Advanced LLM Parameters
  topP: z.coerce.number().min(0).max(1).default(0.9),
  presencePenalty: z.coerce.number().min(-2).max(2).default(0),
  frequencyPenalty: z.coerce.number().min(-2).max(2).default(0),

  // Transcriber
  transcriberProvider: z.string().default("deepgram"),
  transcriberModel: z.string().default("nova-2"),
  transcriberLanguage: z.string().default("en"),
  transcriberStream: z.boolean().default(true),
  transcriberSamplingRate: z.coerce.number().default(16000),
  transcriberEncoding: z.string().default("linear16"),
  transcriberEndpointing: z.coerce.number().default(100),
  
  // Synthesizer (extra)
  synthesizerStream: z.boolean().default(true),
  synthesizerBufferSize: z.coerce.number().default(150),
  synthesizerAudioFormat: z.string().default("wav"),
  elevenlabsModel: z.string().default("eleven_turbo_v2_5"),

  // Input/Output Config - provider must be a valid telephony provider (plivo, twilio, exotel)
  inputProvider: z.string().default("plivo"),
  inputFormat: z.string().default("wav"),
  outputProvider: z.string().default("plivo"),
  outputFormat: z.string().default("wav"),
  
  // Task Config
  hangupAfterSilence: z.coerce.number().default(10),
  incrementalDelay: z.coerce.number().default(400),
  numberOfWordsForInterruption: z.coerce.number().default(2),
  hangupAfterLLMCall: z.boolean().default(false),
  callCancellationPrompt: z.string().optional(),
  backchanneling: z.boolean().default(false),
  backchannelingMessageGap: z.coerce.number().default(5),
  backchannelingStartDelay: z.coerce.number().default(5),
  ambientNoise: z.boolean().default(false),
  ambientNoiseTrack: z.string().default("office-ambience"),
  callTerminate: z.coerce.number().default(90),
  voicemail: z.boolean().default(false),
  disallowUnknownNumbers: z.boolean().default(false),
  
  // Ingest Source Config
  ingestSourceType: z.string().default("api"),
  ingestSourceUrl: z.string().optional(),
  ingestSourceAuthToken: z.string().optional(),
  ingestSourceName: z.string().optional(),
}).partial({
  description: true,
  voiceId: true,
  voiceName: true,
  systemPrompt: true,
  userPrompt: true,
  firstMessage: true,
  provider: true,
  voiceProvider: true,
  status: true,
  createdBy: true,
  bolnaAgentId: true,
  bolnaConfig: true,
  avgRating: true,
  knowledgeBaseIds: true,
  assignedPhoneNumberId: true,
  callForwardingEnabled: true,
  callForwardingNumber: true,
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

export default function AIAgents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create"|"edit">("create");
  const [formInitialValues, setFormInitialValues] = useState<Partial<AgentFormValues> | undefined>(undefined);
  const [selectedAgent, setSelectedAgent] = useState<AiAgent | null>(null);
  const { toast } = useToast();

  // Auto-open dialog from Quick Actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create') {
      setDialogMode("create");
      setFormInitialValues(undefined);
      setIsDialogOpen(true);
      params.delete('action');
      const newUrl = params.toString() ? 
        `${window.location.pathname}?${params.toString()}` : 
        window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  const {
    data: agents,
    isLoading,
    isError,
    error
  } = useQuery<AiAgent[]>({
    queryKey: ['/api/ai-agents'],
  });

  // Real-time updates via WebSocket
  useWebSocketEvent('agent:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
  }, []));

  useWebSocketEvent('agent:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
  }, []));

  useWebSocketEvent('agent:deleted', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
  }, []));

  // Test Call State
  const [isTestCallOpen, setIsTestCallOpen] = useState(false);
  const [testCallAgent, setTestCallAgent] = useState<AiAgent | null>(null);
  const [recipientPhone, setRecipientPhone] = useState("");

  // Inbound Link State
  const [isInboundLinkOpen, setIsInboundLinkOpen] = useState(false);
  const [inboundLinkAgent, setInboundLinkAgent] = useState<AiAgent | null>(null);
  const [selectedPhoneForInbound, setSelectedPhoneForInbound] = useState<string>("");

  // Real-time phone number updates
  useWebSocketEvent('phone:created', useCallback(() => {
    console.log('[AIAgents] Received phone:created event');
    queryClient.invalidateQueries({ queryKey: ['/api/phone-numbers'] });
  }, []));

  useWebSocketEvent('phone:updated', useCallback(() => {
    console.log('[AIAgents] Received phone:updated event');
    queryClient.invalidateQueries({ queryKey: ['/api/phone-numbers'] });
  }, []));

  // State for voice provider filter
  const [voiceProviderFilter, setVoiceProviderFilter] = useState<string>('all');

  // Fetch Bolna voices and models
  const { data: bolnaVoices = [], isLoading: loadingVoices } = useQuery<BolnaVoice[]>({
    queryKey: ['/api/bolna/voices', voiceProviderFilter],
    enabled: isDialogOpen,
    queryFn: async () => {
      const url = voiceProviderFilter === 'all' 
        ? '/api/bolna/voices'
        : `/api/bolna/voices?provider=${voiceProviderFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch voices');
      return response.json();
    },
  });

  // Get unique providers from voices, merged with hardcoded VOICE_PROVIDERS
  const availableProviders = useMemo(() => {
    const providers = new Set<string>(VOICE_PROVIDERS as unknown as string[]);
    // Add any additional providers from the API response
    bolnaVoices.forEach(voice => {
      if (voice.provider) {
        providers.add(voice.provider.toLowerCase());
      }
    });
    return Array.from(providers).sort();
  }, [bolnaVoices]);

  const { data: bolnaModels = [], isLoading: loadingModels } = useQuery<BolnaModel[]>({
    queryKey: ['/api/bolna/models'],
    enabled: isDialogOpen,
  });

  // Fetch phone numbers (Plivo through Bolna) - always enabled for inbound link/unlink buttons
  const { data: exotelPhoneNumbers = [], isLoading: loadingPhoneNumbers, refetch: refetchPhoneNumbers } = useQuery<PhoneNumber[]>({
    queryKey: ['/api/phone-numbers'],
  });

  // Auto-sync phone numbers when dialog opens if none exist
  useEffect(() => {
    if ((isDialogOpen || isInboundLinkOpen) && !loadingPhoneNumbers && exotelPhoneNumbers.length === 0) {
      // Trigger sync in background
      fetch('/api/phone-numbers/sync')
        .then(() => refetchPhoneNumbers())
        .catch(err => console.error('Failed to sync phone numbers:', err));
    }
  }, [isDialogOpen, isInboundLinkOpen, loadingPhoneNumbers, exotelPhoneNumbers.length, refetchPhoneNumbers]);

  // Fetch knowledge base items
  const { data: knowledgeBaseItems = [], isLoading: loadingKnowledgeBase } = useQuery<KnowledgeBaseType[]>({
    queryKey: ['/api/knowledge-base'],
    enabled: isDialogOpen,
  });

  // Handler to open dialog for create
  const handleOpenCreate = (template?: Partial<AgentFormValues>) => {
    setDialogMode("create");
    setFormInitialValues(template);
    setIsDialogOpen(true);
    setSelectedAgent(null);
  };

  // Handler to open dialog for edit
  const handleOpenEdit = (agent: AiAgent) => {
    setDialogMode("edit");
    // Convert null values to undefined for form compatibility
    // Map DB fields to form fields:
    // - agent.provider (DB) -> llmProvider (form) - LLM provider
    // - agent.voiceProvider (DB) -> provider (form) - Voice provider
    const formValues = {
      name: agent.name,
      model: agent.model,
      language: agent.language,
      llmProvider: agent.provider ?? "openai", // DB provider -> form llmProvider
      provider: agent.voiceProvider ?? "elevenlabs", // DB voiceProvider -> form provider (voice)
      status: agent.status,
      description: agent.description ?? undefined,
      voiceId: agent.voiceId ?? undefined,
      voiceName: agent.voiceName ?? undefined,
      systemPrompt: agent.systemPrompt ?? undefined,
      userPrompt: agent.userPrompt ?? undefined,
      firstMessage: agent.firstMessage ?? undefined,
      assignedPhoneNumberId: agent.assignedPhoneNumberId ?? undefined,
      callForwardingNumber: agent.callForwardingNumber ?? undefined,
      callForwardingEnabled: agent.callForwardingEnabled ?? false,
      agentType: agent.agentType ?? undefined,
      temperature: agent.temperature ?? 0.7,
      maxDuration: agent.maxDuration ?? 600,
      maxTokens: agent.maxTokens ?? 150,
      knowledgeBaseIds: agent.knowledgeBaseIds ?? undefined,
      // Extract transcriber settings from bolnaConfig if available
      transcriberProvider: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.transcriber?.provider ?? "deepgram",
      transcriberModel: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.transcriber?.model ?? "nova-2",
      // Extract advanced LLM parameters from bolnaConfig
      topP: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.llm_agent?.llm_config?.top_p ?? 0.9,
      presencePenalty: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.llm_agent?.llm_config?.presence_penalty ?? 0,
      frequencyPenalty: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.llm_agent?.llm_config?.frequency_penalty ?? 0,
      // Extract ElevenLabs model from bolnaConfig
      elevenlabsModel: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.synthesizer?.provider_config?.model ?? "eleven_turbo_v2_5",
      // Extract synthesizer settings
      synthesizerStream: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.synthesizer?.stream ?? true,
      synthesizerBufferSize: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.synthesizer?.buffer_size ?? 150,
      synthesizerAudioFormat: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.synthesizer?.audio_format ?? "wav",
      // Extract input/output config - provider must be a valid telephony provider
      inputProvider: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.input?.provider ?? "plivo",
      inputFormat: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.input?.format ?? "wav",
      outputProvider: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.output?.provider ?? "plivo",
      outputFormat: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.tools_config?.output?.format ?? "wav",
      // Extract task_config settings
      hangupAfterSilence: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.hangup_after_silence ?? 10,
      incrementalDelay: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.incremental_delay ?? 400,
      numberOfWordsForInterruption: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.number_of_words_for_interruption ?? 2,
      hangupAfterLLMCall: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.hangup_after_LLMCall ?? false,
      backchanneling: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.backchanneling ?? false,
      backchannelingMessageGap: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.backchanneling_message_gap ?? 5,
      backchannelingStartDelay: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.backchanneling_start_delay ?? 5,
      ambientNoise: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.ambient_noise ?? false,
      ambientNoiseTrack: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.ambient_noise_track ?? "office-ambience",
      callTerminate: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.call_terminate ?? 90,
      voicemail: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.voicemail ?? false,
      disallowUnknownNumbers: (agent.bolnaConfig as any)?.agent_config?.tasks?.[0]?.task_config?.disallow_unknown_numbers ?? false,
    };
    setFormInitialValues(formValues);
    setSelectedAgent(agent);
    setIsDialogOpen(true);
  };

  // Reset voice provider filter when dialog opens
  useEffect(() => {
    if (isDialogOpen && dialogMode === "create") {
      setVoiceProviderFilter('all');
      // Don't set voiceProvider to 'all' - keep the default 'elevenlabs'
    }
  }, [isDialogOpen, dialogMode]);

  const createMutation = useMutation({
    mutationFn: async (data: AgentFormValues) => {
      // Build payload - only include defined fields from schema
      const payload: any = {
        name: data.name,
        model: data.model,
        language: data.language,
        temperature: data.temperature ?? 0.7,
        maxDuration: data.maxDuration ?? 600,
        maxTokens: data.maxTokens ?? 150,
        provider: data.llmProvider ?? "openai", // Store LLM provider as provider in DB
        voiceProvider: data.provider ?? "elevenlabs", // Voice provider from form's provider field
        status: data.status ?? "active",
        callForwardingEnabled: data.callForwardingEnabled ?? false,
      };

      // Only add optional fields if they have values
      if (data.description) payload.description = data.description;
      if (data.voiceId) payload.voiceId = data.voiceId;
      if (data.voiceName) payload.voiceName = data.voiceName;
      if (data.systemPrompt) payload.systemPrompt = data.systemPrompt;
      if (data.userPrompt) payload.userPrompt = data.userPrompt;
      if (data.firstMessage) payload.firstMessage = data.firstMessage;
      if (data.knowledgeBaseIds && data.knowledgeBaseIds.length > 0) {
        payload.knowledgeBaseIds = data.knowledgeBaseIds;
      }
      if (data.assignedPhoneNumberId) payload.assignedPhoneNumberId = data.assignedPhoneNumberId;
      if (data.callForwardingNumber) payload.callForwardingNumber = data.callForwardingNumber;

      // Construct Bolna Config
      const bolnaConfig = {
        agent_config: {
          agent_name: data.name,
          agent_welcome_message: data.firstMessage,
          webhook_url: data.webhookUrl,
          agent_type: data.agentType,
          tasks: [{
            task_type: "conversation",
            tools_config: {
              llm_agent: {
                // Use knowledgebase_agent when knowledge bases are selected
                agent_type: (data.knowledgeBaseIds && data.knowledgeBaseIds.length > 0) ? "knowledgebase_agent" : "simple_llm_agent",
                agent_flow_type: "streaming",
                llm_config: {
                  agent_flow_type: "streaming",
                  provider: data.llmProvider ?? "openai",
                  family: data.llmProvider ?? "openai",
                  model: data.model,
                  max_tokens: data.maxTokens ?? 150,
                  temperature: data.temperature ?? 0.7,
                  top_p: data.topP ?? 0.9,
                  presence_penalty: data.presencePenalty ?? 0,
                  frequency_penalty: data.frequencyPenalty ?? 0,
                  request_json: true
                }
              },
              synthesizer: {
                provider: data.provider ?? "elevenlabs",
                provider_config: {
                  voice: data.voiceName || data.voiceId,
                  voice_id: data.voiceId,
                  language: data.language,
                  // Include ElevenLabs model if provider is elevenlabs
                  ...(data.provider === "elevenlabs" ? { model: data.elevenlabsModel ?? "eleven_turbo_v2_5" } : {})
                },
                stream: data.synthesizerStream ?? true,
                buffer_size: data.synthesizerBufferSize ?? 150,
                audio_format: data.synthesizerAudioFormat ?? "wav"
              },
              transcriber: {
                provider: data.transcriberProvider ?? "deepgram",
                model: data.transcriberModel ?? "nova-2",
                language: data.language?.split('-')[0] || 'en',
                stream: data.transcriberStream ?? true,
                sampling_rate: data.transcriberSamplingRate ?? 16000,
                encoding: data.transcriberEncoding ?? "linear16",
                endpointing: data.transcriberEndpointing ?? 100
              },
              input: {
                provider: data.inputProvider ?? "plivo",
                format: data.inputFormat ?? "wav"
              },
              output: {
                provider: data.outputProvider ?? "plivo",
                format: data.outputFormat ?? "wav"
              }
            },
            toolchain: {
              execution: "parallel",
              pipelines: [["transcriber", "llm", "synthesizer"]]
            },
            task_config: {
              hangup_after_silence: data.hangupAfterSilence,
              incremental_delay: data.incrementalDelay,
              number_of_words_for_interruption: data.numberOfWordsForInterruption,
              hangup_after_LLMCall: data.hangupAfterLLMCall,
              call_cancellation_prompt: data.callCancellationPrompt,
              backchanneling: data.backchanneling,
              backchanneling_message_gap: data.backchannelingMessageGap,
              backchanneling_start_delay: data.backchannelingStartDelay,
              ambient_noise: data.ambientNoise,
              ambient_noise_track: data.ambientNoiseTrack,
              call_terminate: data.callTerminate,
              voicemail: data.voicemail,
              disallow_unknown_numbers: data.disallowUnknownNumbers
            }
          }],
          ingest_source_config: data.ingestSourceUrl ? {
            source_type: data.ingestSourceType,
            source_url: data.ingestSourceUrl,
            source_auth_token: data.ingestSourceAuthToken,
            source_name: data.ingestSourceName
          } : undefined
        }
      };

      payload.bolnaConfig = bolnaConfig;

      const res = await apiRequest('POST', '/api/ai-agents', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      setIsDialogOpen(false);
      setSelectedAgent(null);
      setFormInitialValues(undefined);
      toast({
        title: "Success",
        description: "AI Agent created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create AI agent",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AgentFormValues & { _agentId?: string }) => {
      // Use passed agentId or fall back to selectedAgent
      const agentId = data._agentId || selectedAgent?.id;
      if (!agentId) throw new Error("No agent selected");

      // Build payload - only include defined fields from schema
      const payload: any = {
        name: data.name,
        model: data.model,
        language: data.language,
        temperature: data.temperature ?? 0.7,
        maxDuration: data.maxDuration ?? 600,
        maxTokens: data.maxTokens ?? 150,
        provider: data.llmProvider ?? "openai", // Store LLM provider as provider in DB
        voiceProvider: data.provider ?? "elevenlabs", // Voice provider from form's provider field
        status: data.status ?? "active",
        callForwardingEnabled: data.callForwardingEnabled ?? false,
      };

      // Only add optional fields if they have values
      if (data.description) payload.description = data.description;
      if (data.voiceId) payload.voiceId = data.voiceId;
      if (data.voiceName) payload.voiceName = data.voiceName;
      if (data.systemPrompt) payload.systemPrompt = data.systemPrompt;
      if (data.userPrompt) payload.userPrompt = data.userPrompt;
      if (data.firstMessage) payload.firstMessage = data.firstMessage;
      if (data.knowledgeBaseIds && data.knowledgeBaseIds.length > 0) {
        payload.knowledgeBaseIds = data.knowledgeBaseIds;
      }
      if (data.assignedPhoneNumberId) payload.assignedPhoneNumberId = data.assignedPhoneNumberId;
      if (data.callForwardingNumber) payload.callForwardingNumber = data.callForwardingNumber;

      // Construct Bolna Config
      const bolnaConfig = {
        agent_config: {
          agent_name: data.name,
          agent_welcome_message: data.firstMessage,
          webhook_url: data.webhookUrl,
          agent_type: data.agentType,
          tasks: [{
            task_type: "conversation",
            tools_config: {
              llm_agent: {
                // Use knowledgebase_agent when knowledge bases are selected
                agent_type: (data.knowledgeBaseIds && data.knowledgeBaseIds.length > 0) ? "knowledgebase_agent" : "simple_llm_agent",
                agent_flow_type: "streaming",
                llm_config: {
                  agent_flow_type: "streaming",
                  provider: data.llmProvider ?? "openai",
                  family: data.llmProvider ?? "openai",
                  model: data.model,
                  max_tokens: data.maxTokens ?? 150,
                  temperature: data.temperature ?? 0.7,
                  top_p: data.topP ?? 0.9,
                  presence_penalty: data.presencePenalty ?? 0,
                  frequency_penalty: data.frequencyPenalty ?? 0,
                  request_json: true
                }
              },
              synthesizer: {
                provider: data.provider ?? "elevenlabs",
                provider_config: {
                  voice: data.voiceName || data.voiceId,
                  voice_id: data.voiceId,
                  language: data.language,
                  // Include ElevenLabs model if provider is elevenlabs
                  ...(data.provider === "elevenlabs" ? { model: data.elevenlabsModel ?? "eleven_turbo_v2_5" } : {})
                },
                stream: data.synthesizerStream ?? true,
                buffer_size: data.synthesizerBufferSize ?? 150,
                audio_format: data.synthesizerAudioFormat ?? "wav"
              },
              transcriber: {
                provider: data.transcriberProvider ?? "deepgram",
                model: data.transcriberModel ?? "nova-2",
                language: data.language?.split('-')[0] || 'en',
                stream: data.transcriberStream ?? true,
                sampling_rate: data.transcriberSamplingRate ?? 16000,
                encoding: data.transcriberEncoding ?? "linear16",
                endpointing: data.transcriberEndpointing ?? 100
              },
              input: {
                provider: data.inputProvider ?? "plivo",
                format: data.inputFormat ?? "wav"
              },
              output: {
                provider: data.outputProvider ?? "plivo",
                format: data.outputFormat ?? "wav"
              }
            },
            toolchain: {
              execution: "parallel",
              pipelines: [["transcriber", "llm", "synthesizer"]]
            },
            task_config: {
              hangup_after_silence: data.hangupAfterSilence,
              incremental_delay: data.incrementalDelay,
              number_of_words_for_interruption: data.numberOfWordsForInterruption,
              hangup_after_LLMCall: data.hangupAfterLLMCall,
              call_cancellation_prompt: data.callCancellationPrompt,
              backchanneling: data.backchanneling,
              backchanneling_message_gap: data.backchannelingMessageGap,
              backchanneling_start_delay: data.backchannelingStartDelay,
              ambient_noise: data.ambientNoise,
              ambient_noise_track: data.ambientNoiseTrack,
              call_terminate: data.callTerminate,
              voicemail: data.voicemail,
              disallow_unknown_numbers: data.disallowUnknownNumbers
            }
          }],
          ingest_source_config: data.ingestSourceUrl ? {
            source_type: data.ingestSourceType,
            source_url: data.ingestSourceUrl,
            source_auth_token: data.ingestSourceAuthToken,
            source_name: data.ingestSourceName
          } : undefined
        }
      };

      payload.bolnaConfig = bolnaConfig;

      const res = await apiRequest('PATCH', `/api/ai-agents/${agentId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      setIsDialogOpen(false);
      setSelectedAgent(null);
      setFormInitialValues(undefined);
      toast({
        title: "Success",
        description: "AI Agent updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI agent",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AgentFormValues) => {
    if (dialogMode === "edit" && selectedAgent) {
      // Pass agentId directly to avoid race condition with state clearing
      const agentId = selectedAgent.id;
      updateMutation.mutate({ ...data, _agentId: agentId } as any);
    } else {
      createMutation.mutate(data);
    }
    // Note: Dialog closing is handled in onSuccess callbacks
  };

  const syncMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest('POST', `/api/ai-agents/${agentId}/sync`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      toast({
        title: "Success",
        description: "Agent synced successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync agent",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest('DELETE', `/api/ai-agents/${agentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      toast({
        title: "Success",
        description: "AI Agent deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete AI agent",
        variant: "destructive",
      });
    },
  });

  const testCallMutation = useMutation({
    mutationFn: async (data: { agentId: string; recipientPhone: string }) => {
      const res = await apiRequest('POST', '/api/calls/initiate', data);
      return res.json();
    },
    onSuccess: () => {
      setIsTestCallOpen(false);
      setRecipientPhone("");
      setTestCallAgent(null);
      toast({
        title: "Call Initiated",
        description: "Test call has been initiated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Call Failed",
        description: error.message || "Failed to initiate call",
        variant: "destructive",
      });
    },
  });

  // Inbound Link Mutation
  const inboundLinkMutation = useMutation({
    mutationFn: async (data: { agentId: string; phoneNumberId: string }) => {
      const res = await apiRequest('POST', '/api/bolna/inbound/setup', data);
      return res.json();
    },
    onSuccess: () => {
      setIsInboundLinkOpen(false);
      setSelectedPhoneForInbound("");
      setInboundLinkAgent(null);
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/phone-numbers'] });
      toast({
        title: "Inbound Linked",
        description: "Agent is now linked to handle inbound calls on this number",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Link Failed",
        description: error.message || "Failed to link inbound number",
        variant: "destructive",
      });
    },
  });

  // Inbound Unlink Mutation
  const inboundUnlinkMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const res = await apiRequest('POST', '/api/bolna/inbound/unlink', { phoneNumberId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/phone-numbers'] });
      toast({
        title: "Inbound Unlinked",
        description: "Agent is no longer handling inbound calls on this number",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unlink Failed",
        description: error.message || "Failed to unlink inbound number",
        variant: "destructive",
      });
    },
  });

  const handleTestCall = (agent: AiAgent) => {
    setTestCallAgent(agent);
    setRecipientPhone("");
    setIsTestCallOpen(true);
  };

  const handleInboundLink = (agent: AiAgent) => {
    setInboundLinkAgent(agent);
    setSelectedPhoneForInbound("");
    setIsInboundLinkOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-2">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Voice Agents</h1>
            <p className="text-muted-foreground mt-1">Manage your AI voice agents</p>
          </div>
          <Button data-testid="button-create-agent" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-3/4 bg-muted rounded" />
                </div>
              </CardContent>
              <CardFooter>
                <div className="h-10 w-full bg-muted rounded" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <Bot className="h-10 w-10 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Error loading AI Agents</h2>
        <p className="text-destructive mb-4">{error?.message || "Failed to load agents. Please try again later."}</p>
        <Button onClick={() => window.location.reload()} variant="destructive">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-ai-agents">
            AI Voice Agents
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-subtitle">
            Manage your AI voice agents
          </p>
        </div>
        <Button onClick={() => handleOpenCreate()} data-testid="button-create-agent">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {!agents || agents.length === 0 ? (
        <Card className="p-12 text-center" data-testid="card-empty-state">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1" data-testid="heading-empty-title">
                No AI Agents Yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-empty-description">
                Create your first AI voice agent to start handling calls
              </p>
              <Button onClick={() => handleOpenCreate()} data-testid="button-create-first-agent">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2" data-testid={`text-agent-name-${agent.id}`}>
                    {agent.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge
                      variant={agent.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                      data-testid={`badge-status-${agent.id}`}
                    >
                      {agent.status}
                    </Badge>
                    {!agent.bolnaAgentId && (
                      <Badge variant="destructive" className="text-xs">
                        Not Synced
                      </Badge>
                    )}
                  </div>
                </div>
                <Bot className="h-5 w-5 text-muted-foreground" />
              </CardHeader>

              <CardContent className="space-y-3">
                {!agent.bolnaAgentId && (!agent.voiceId || agent.voiceId === 'male' || agent.voiceId === 'female') && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-destructive mb-1">Configuration Error</p>
                      <p className="text-muted-foreground">
                        This agent has invalid voice configuration. Please delete and recreate with a valid voice from the voice library.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Voice</p>
                    <p className="font-medium" data-testid={`text-voice-${agent.id}`}>
                      {agent.voiceName || agent.voiceId || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Language</p>
                    <p className="font-medium" data-testid={`text-language-${agent.id}`}>
                      {agent.language}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Model</p>
                    <p className="font-medium" data-testid={`text-model-${agent.id}`}>
                      {agent.model}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Provider</p>
                    <p className="font-medium" data-testid={`text-provider-${agent.id}`}>
                      {agent.provider}
                    </p>
                  </div>
                </div>

                {agent.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-description-${agent.id}`}>
                    {agent.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-2">
                {!agent.bolnaAgentId && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => syncMutation.mutate(agent.id)}
                    disabled={syncMutation.isPending}
                    data-testid={`button-sync-${agent.id}`}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncMutation.isPending ? 'Syncing...' : 'Sync Agent'}
                  </Button>
                )}
                <div className="flex gap-2 w-full">
                  {agent.bolnaAgentId && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      data-testid={`button-call-${agent.id}`}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenEdit(agent)}
                    data-testid={`button-settings-${agent.id}`}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Settings
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
                        deleteMutation.mutate(agent.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${agent.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
                {/* Inbound Link/Unlink Controls */}
                {agent.bolnaAgentId && (
                  <div className="flex gap-2 w-full mt-2">
                    {agent.assignedPhoneNumberId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() => {
                          // Find the phone number's Bolna ID
                          const phone = exotelPhoneNumbers.find(p => p.id === agent.assignedPhoneNumberId);
                          if (phone?.phoneNumber) {
                            inboundUnlinkMutation.mutate(phone.phoneNumber);
                          } else {
                            toast({
                              title: "Error",
                              description: "Phone number not found",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={inboundUnlinkMutation.isPending}
                        data-testid={`button-unlink-inbound-${agent.id}`}
                      >
                        <PhoneOff className="h-3 w-3 mr-1" />
                        {inboundUnlinkMutation.isPending ? 'Unlinking...' : 'Unlink Inbound'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => handleInboundLink(agent)}
                        disabled={inboundLinkMutation.isPending}
                        data-testid={`button-link-inbound-${agent.id}`}
                      >
                        <PhoneIncoming className="h-3 w-3 mr-1" />
                        Link Inbound
                      </Button>
                    )}
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="mt-8">
          <Card data-testid="card-stats">
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-agents">
                    {agents.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Agents</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-active-agents">
                    {agents.filter(a => a.status === 'active').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-inactive-agents">
                    {agents.filter(a => a.status === 'inactive').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-testing-agents">
                    {agents.filter(a => a.status === 'testing').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Testing</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AgentFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedAgent(null);
            setFormInitialValues(undefined);
          }
        }}
        initialValues={formInitialValues}
        onSubmit={handleSubmit}
        mode={dialogMode}
        loading={dialogMode === "edit" ? updateMutation.isPending : createMutation.isPending}
        agentFormSchema={agentFormSchema}
        models={bolnaModels}
        voices={bolnaVoices}
        voiceProviders={availableProviders}
        llmProviders={LLM_PROVIDERS as unknown as string[]}
        transcriberProviders={TRANSCRIBER_PROVIDERS as unknown as string[]}
        transcriberModels={TRANSCRIBER_MODELS}
        phoneNumbers={exotelPhoneNumbers.map(p => ({ id: p.id, number: p.phoneNumber || p.friendlyName || 'Unknown' }))}
        knowledgeBaseItems={knowledgeBaseItems}
      />

      <Dialog open={isTestCallOpen} onOpenChange={setIsTestCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Call - {testCallAgent?.name}</DialogTitle>
            <DialogDescription>
              Enter a phone number to make a test call with this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="phone" className="text-right text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestCallOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => testCallAgent && testCallMutation.mutate({
                agentId: testCallAgent.id,
                recipientPhone
              })}
              disabled={!recipientPhone || testCallMutation.isPending}
            >
              {testCallMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Call Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inbound Link Dialog */}
      <Dialog open={isInboundLinkOpen} onOpenChange={setIsInboundLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Inbound - {inboundLinkAgent?.name}</DialogTitle>
            <DialogDescription>
              Select a phone number to link this agent for handling inbound calls.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inbound-phone">Phone Number</Label>
              <Select
                value={selectedPhoneForInbound}
                onValueChange={setSelectedPhoneForInbound}
              >
                <SelectTrigger id="inbound-phone">
                  <SelectValue placeholder="Select a phone number" />
                </SelectTrigger>
                <SelectContent>
                  {exotelPhoneNumbers.filter(p => p.status === 'active').map((phone) => (
                    <SelectItem key={phone.id} value={phone.phoneNumber}>
                      {phone.friendlyName || phone.phoneNumber} ({phone.phoneNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {exotelPhoneNumbers.filter(p => p.status === 'active').length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No phone numbers available. Please add a phone number first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInboundLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (inboundLinkAgent?.bolnaAgentId && selectedPhoneForInbound) {
                  inboundLinkMutation.mutate({
                    agentId: inboundLinkAgent.bolnaAgentId,
                    phoneNumberId: selectedPhoneForInbound
                  });
                }
              }}
              disabled={!selectedPhoneForInbound || inboundLinkMutation.isPending}
            >
              {inboundLinkMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Link Inbound
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
