import type { AiAgent } from "@shared/schema";

const BOLNA_API_URL = "https://api.bolna.ai";
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;

if (!BOLNA_API_KEY) {
  console.error("BOLNA_API_KEY environment variable is not set");
}

// Bolna API v2 Types - Matching exact API structure
interface BolnaAgentConfigV2 {
  agent_config: {
    agent_name: string;
    agent_welcome_message?: string;
    webhook_url?: string | null;
    agent_type: string;
    tasks: Array<{
      task_type: string;
      tools_config?: {
        llm_agent?: {
          agent_type: string;
          agent_flow_type: string;
          llm_config?: {
            agent_flow_type: string;
            provider: string;
            family?: string;
            model: string;
            summarization_details?: any;
            extraction_details?: any;
            max_tokens: number;
            presence_penalty: number;
            frequency_penalty: number;
            base_url?: string;
            top_p: number;
            min_p: number;
            top_k: number;
            temperature: number;
            request_json: boolean;
          };
          routes?: {
            embedding_model?: string;
            routes?: Array<{
              route_name: string;
              utterances: string[];
              response: string;
              score_threshold: number;
            }>;
          };
        };
        llm_config?: {
          agent_flow_type: string;
          provider: string;
          family: string;
          model: string;
          summarization_details?: any;
          extraction_details?: any;
          max_tokens: number;
          presence_penalty: number;
          frequency_penalty: number;
          base_url: string;
          top_p: number;
          min_p: number;
          top_k: number;
          temperature: number;
          request_json: boolean;
        };
        synthesizer?: {
          provider: string;
          provider_config: {
            voice: string;
            voice_id?: string;
            engine?: string;
            sampling_rate?: string;
            language: string;
            model?: string;
          };
          stream: boolean;
          buffer_size: number;
          audio_format: string;
        };
        transcriber?: {
          provider: string;
          model: string;
          language: string;
          stream: boolean;
          sampling_rate: number;
          encoding: string;
          endpointing: number;
        };
        input?: {
          provider: string;
          format: string;
        };
        output?: {
          provider: string;
          format: string;
        };
        api_tools?: any;
      };
      toolchain?: {
        execution: string;
        pipelines: string[][];
      };
      task_config?: {
        hangup_after_silence?: number;
        incremental_delay?: number;
        number_of_words_for_interruption?: number;
        hangup_after_LLMCall?: boolean;
        call_cancellation_prompt?: string | null;
        backchanneling?: boolean;
        backchanneling_message_gap?: number;
        backchanneling_start_delay?: number;
        ambient_noise?: boolean;
        ambient_noise_track?: string;
        call_terminate?: number;
        voicemail?: boolean;
        inbound_limit?: number;
        whitelist_phone_numbers?: string[];
        disallow_unknown_numbers?: boolean;
      };
    }>;
    ingest_source_config?: {
      source_type: string;
      source_url: string;
      source_auth_token?: string;
      source_name?: string;
    };
  };
}

// Bolna API v2 Request structure - agent_prompts is at top level, not inside agent_config
interface BolnaAgentRequestV2 {
  agent_config: BolnaAgentConfigV2['agent_config'];
  agent_prompts: {
    task_1: {
      system_prompt: string;
    };
  };
}

interface BolnaVoice {
  voice_id?: string;
  id?: string;
  name?: string;
  voice_name?: string;
  provider?: string;
  language?: string;
  gender?: string;
  description?: string;
}

interface BolnaModel {
  model: string;
  provider: string;
  family?: string;
  description?: string;
}

interface BolnaKnowledgeBase {
  rag_id: string;
  file_name?: string;
  name?: string;
  source_type?: 'pdf' | 'url';
  status?: 'processing' | 'processed' | 'error';
  chunk_size?: number;
  similarity_top_k?: number;
  overlapping?: number;
  humanized_created_at?: string;
  created_at?: string;
  updated_at?: string;
  vector_id?: string;
}

interface BolnaKnowledgeBaseDeleteResponse {
  message: string;
  state: 'deleted';
}

interface BolnaAgentConfig {
  agent_name: string;
  agent_type: string;
  agent_welcome_message?: string;
  tasks: BolnaTask[];
  llm_config?: {
    model?: string;
    provider?: string;
    temperature?: number;
    max_tokens?: number;
  };
  voice_config?: {
    provider?: string;
    voice_id?: string;
    language?: string;
  };
}

interface BolnaTask {
  task_type: string;
  toolchain?: {
    execution: string;
    pipelines: any[];
  };
}

interface BolnaAgent {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  created_at: string;
  updated_at: string;
}

interface BolnaCallRequest {
  agent_id: string;
  recipient_phone_number: string;
  from?: string;
  metadata?: Record<string, any>;
}

interface BolnaCallResponse {
  call_id: string;
  status: string;
  agent_id: string;
  recipient_phone_number: string;
  created_at: string;
}

interface BolnaWebhookPayload {
  call_id: string;
  status: string;
  duration?: number;
  transcript?: string;
  recording_url?: string;
  metadata?: Record<string, any>;
}

export class BolnaClient {
  private apiKey: string | null;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = BOLNA_API_KEY || null;
    this.baseUrl = BOLNA_API_URL;
    this.isConfigured = !!BOLNA_API_KEY;

    if (!this.isConfigured) {
      console.warn("⚠️  Bolna API is not configured. AI agent Bolna integration will be disabled.");
      console.warn("   Set BOLNA_API_KEY environment variable to enable Bolna features.");
    }
  }

  /**
   * Normalize webhook URL to ensure it has a protocol
   * If the URL doesn't start with http:// or https://, add https://
   */
  private normalizeWebhookUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    // If URL already has protocol, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Add https:// if missing
    return `https://${url}`;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured || !this.apiKey) {
      throw new Error("Bolna API is not configured. Set BOLNA_API_KEY to use Bolna features.");
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = null;

        // Try to parse error as JSON
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // If not JSON, use the text as is
          errorData = { message: errorText };
        }

        // Create error with full details
        const error = new Error(
          `Bolna API error (${response.status}): ${errorData.message || errorText}`
        ) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        };
        throw error;
      }

      // Check if response is actually JSON
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Bolna API returned non-JSON response (${contentType || 'unknown'}): ${text.substring(0, 200)}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Bolna API request failed:", error);
      throw error;
    }
  }

  async configureProvider(providerName: string, providerValue: string): Promise<any> {
    this.ensureConfigured();

    console.log(`[Bolna] Configuring provider: ${providerName}`);

    try {
      return await this.request<any>("/providers", {
        method: "POST",
        body: JSON.stringify({
          provider_name: providerName,
          provider_value: providerValue,
        }),
      });
    } catch (error) {
      console.error(`Failed to configure provider ${providerName}:`, error);
      throw error;
    }
  }

  async registerPhoneNumber(phoneNumber: string, provider: string = "plivo"): Promise<any> {
    this.ensureConfigured();

    console.log(`[Bolna] Registering phone number: ${phoneNumber} with provider: ${provider}`);

    try {
      return await this.request<any>("/phone-numbers", {
        method: "POST",
        body: JSON.stringify({
          phone_number: phoneNumber,
          provider: provider,
        }),
      });
    } catch (error) {
      console.error(`Failed to register phone number ${phoneNumber}:`, error);
      throw error;
    }
  }

  async searchAvailablePhoneNumbers(params?: {
    country?: string;
    pattern?: string;
    type?: string;
  }): Promise<any> {
    this.ensureConfigured();

    try {
      const queryParams = new URLSearchParams();
      if (params?.country) queryParams.append('country', params.country);
      if (params?.pattern) queryParams.append('pattern', params.pattern);
      if (params?.type) queryParams.append('type', params.type);

      const queryString = queryParams.toString();
      const endpoint = `/phone-numbers/search${queryString ? `?${queryString}` : ''}`;

      return await this.request<any>(endpoint);
    } catch (error) {
      console.error('Failed to search available phone numbers from Bolna:', error);
      throw error;
    }
  }

  /**
   * List all phone numbers registered in Bolna account
   * Returns numbers with telephony provider (twilio, plivo, vonage, etc.)
   */
  async listRegisteredPhoneNumbers(): Promise<Array<{
    id: string;
    phone_number: string;
    agent_id: string | null;
    telephony_provider: string;
    price: string;
    rented: boolean;
    created_at: string;
    updated_at: string;
    renewal_at: string;
    humanized_created_at: string;
    humanized_updated_at: string;
  }>> {
    this.ensureConfigured();

    try {
      return await this.request<Array<{
        id: string;
        phone_number: string;
        agent_id: string | null;
        telephony_provider: string;
        price: string;
        rented: boolean;
        created_at: string;
        updated_at: string;
        renewal_at: string;
        humanized_created_at: string;
        humanized_updated_at: string;
      }>>("/phone-numbers/all");
    } catch (error) {
      console.error('Failed to list registered phone numbers from Bolna:', error);
      throw error;
    }
  }

  /**
   * Initiate a call using Bolna API v2 (POST /agent/initiate)
   * This is the preferred method for initiating calls
   */
  /**
   * Initiate a call using Bolna API (POST /call)
   * aligned with official documentation
   */
  async initiateCallV2(params: {
    agent_id: string;
    recipient_phone_number: string;
    from_phone_number?: string;
    user_data?: any;
    metadata?: any;
  }): Promise<{ call_id: string; execution_id?: string; status: string }> {
    this.ensureConfigured();
    console.log(`[Bolna] initiateCallV2 called with params:`, JSON.stringify(params, null, 2));

    console.log(`[Bolna] Initiating available call for agent ${params.agent_id} to ${params.recipient_phone_number}`);

    try {
      // Build request body per Bolna API docs (POST /call)
      const body: any = {
        agent_id: params.agent_id,
        recipient_phone_number: params.recipient_phone_number,
      };

      // Map from_phone_number if present
      if (params.from_phone_number) {
        body.from_phone_number = params.from_phone_number;
      }

      // Map user_data if present
      if (params.user_data) {
        body.user_data = params.user_data;
      }

      // Use scheduled_at if we ever need it, currently immediate

      const response = await this.request<any>('/call', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      console.log('[Bolna] Call initiated successfully (POST /call):', response);
      // Map execution_id to call_id for consistency if needed, but return raw response
      if (response.execution_id && !response.call_id) {
        response.call_id = response.execution_id;
      }
      return response;
    } catch (error) {
      console.error('[Bolna] Error initiating call:', error);
      throw error;
    }
  }

  /**
   * Initiate a call using Bolna API v1 (POST /call)
   * Legacy method, used as fallback
   */
  async initiateCall(params: BolnaCallRequest): Promise<BolnaCallResponse> {
    this.ensureConfigured();
    console.log(`[Bolna] Initiating V1 call for agent ${params.agent_id} to ${params.recipient_phone_number}`);

    try {
      const response = await this.request<BolnaCallResponse>('/call', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      console.log('[Bolna] Call initiated successfully (V1):', response);
      return response;
    } catch (error) {
      console.error('[Bolna] Error initiating call (V1):', error);
      throw error;
    }
  }
  async createAgent(agentData: AiAgent): Promise<BolnaAgent> {
    this.ensureConfigured();

    // If full Bolna config is provided, use it directly but validate/ensure required fields
    if ((agentData as any).bolnaConfig) {
      console.log('[Bolna] Creating agent using provided full configuration');
      const config = (agentData as any).bolnaConfig as BolnaAgentConfigV2;

      // CRITICAL: Trim agent name to avoid leading/trailing whitespace issues
      if (config.agent_config.agent_name) {
        config.agent_config.agent_name = config.agent_config.agent_name.trim();
      }

      // Ensure webhook URL is set if not provided
      if (!config.agent_config.webhook_url) {
        // Use env var or default to platform.automitra.ai
        const envUrl = process.env.PUBLIC_WEBHOOK_URL || "https://platform.automitra.ai";
        const baseUrl = this.normalizeWebhookUrl(envUrl);
        config.agent_config.webhook_url = baseUrl ? `${baseUrl}/api/webhooks/bolna/call-status` : null;
      } else {
        // Normalize existing webhook URL
        config.agent_config.webhook_url = this.normalizeWebhookUrl(config.agent_config.webhook_url);
      }

      // CRITICAL: Ensure synthesizer has required voice fields for ElevenLabs
      // and fix input/output providers if set to "default"
      if (config.agent_config.tasks && config.agent_config.tasks.length > 0) {
        const task = config.agent_config.tasks[0];
        
        // Fix input/output providers - "default" is not a valid Bolna provider
        // Must be a valid telephony provider like "plivo", "twilio", "exotel", etc.
        const telephonyProvider = (agentData as any).telephonyProvider || "plivo";
        if (task.tools_config?.input) {
          if (!task.tools_config.input.provider || task.tools_config.input.provider === "default") {
            task.tools_config.input.provider = telephonyProvider;
            console.log(`[Bolna] Fixed input provider from "default" to "${telephonyProvider}"`);
          }
        }
        if (task.tools_config?.output) {
          if (!task.tools_config.output.provider || task.tools_config.output.provider === "default") {
            task.tools_config.output.provider = telephonyProvider;
            console.log(`[Bolna] Fixed output provider from "default" to "${telephonyProvider}"`);
          }
        }
        
        // CRITICAL: Ensure toolchain is set - required by Bolna API v2
        if (!task.toolchain) {
          task.toolchain = {
            execution: "parallel",
            pipelines: [["transcriber", "llm", "synthesizer"]]
          };
          console.log(`[Bolna] Added missing toolchain configuration`);
        }
        
        if (task.tools_config?.synthesizer) {
          const synthesizer = task.tools_config.synthesizer;
          const voiceProvider = synthesizer.provider || (agentData as any).voiceProvider;

          // If ElevenLabs, ensure voice (name) and voice_id (ID) are set per API spec
          if (voiceProvider === "elevenlabs" || voiceProvider === "ElevenLabs") {
            if (!synthesizer.provider_config) {
              synthesizer.provider_config = { voice: '', language: 'en-US' };
            }
            // Use voiceId from agentData if not set in config
            const voiceId = (agentData as any).voiceId || synthesizer.provider_config.voice_id;
            const voiceName = (agentData as any).voiceName || synthesizer.provider_config.voice || voiceId;
            if (voiceId) {
              synthesizer.provider_config.voice = voiceName; // Voice name (string)
              synthesizer.provider_config.voice_id = voiceId; // Unique voice ID
              // Ensure model is set for ElevenLabs
              if (!synthesizer.provider_config.model) {
                synthesizer.provider_config.model = "eleven_turbo_v2_5";
              }
              // Note: sampling_rate is not a valid ElevenLabs provider_config field
              // It belongs in the transcriber config, not synthesizer
            } else {
              throw new Error("Voice ID is required for ElevenLabs. Please select a voice.");
            }
          } else if (synthesizer.provider_config) {
            // For other providers, ensure voice is set
            if (!synthesizer.provider_config.voice && (agentData as any).voiceId) {
              synthesizer.provider_config.voice = (agentData as any).voiceId;
            }
            if (!synthesizer.provider_config.language && (agentData as any).language) {
              synthesizer.provider_config.language = (agentData as any).language;
            }
          }
        }
      }

      console.log('[Bolna] Final config with voice validation:', JSON.stringify(config, null, 2));

      // Build request with agent_prompts at top level (required by API)
      const request: BolnaAgentRequestV2 = {
        agent_config: config.agent_config,
        agent_prompts: {
          task_1: {
            system_prompt: (agentData as any).systemPrompt || "You are a helpful AI voice assistant."
          }
        }
      };

      return await this.request<BolnaAgent>("/v2/agent", {
        method: "POST",
        body: JSON.stringify(request),
      });
    }

    console.log('[Bolna] Creating agent with data:', JSON.stringify({
      name: agentData.name,
      voiceId: (agentData as any).voiceId,
      voiceProvider: (agentData as any).voiceProvider,
      model: (agentData as any).model,
      provider: (agentData as any).provider,
    }, null, 2));

    // Validate required fields
    if (!(agentData as any).voiceId) {
      throw new Error("Voice ID is required to create a Bolna agent. Please select a voice first.");
    }

    // Determine voice provider from voiceProvider field
    const voiceProvider = (agentData as any).voiceProvider && (agentData as any).voiceProvider !== 'all'
      ? (agentData as any).voiceProvider
      : "elevenlabs";

    // Build synthesizer config - Bolna requires specific fields per provider
    let synthesizerConfig: any;

    if (voiceProvider === "elevenlabs") {
      // ElevenLabs requires voice (name), voice_id (ID), and model per API docs
      // According to API: voice is the name, voice_id is the unique ID
      // If voiceName is not available, we need to use voiceId for both (some voices may not have separate names)
      const voiceName = (agentData as any).voiceName || (agentData as any).voiceId || "";
      if (!(agentData as any).voiceId) {
        throw new Error("Voice ID is required for ElevenLabs. Please select a voice.");
      }
      if (!voiceName) {
        throw new Error("Voice name is required for ElevenLabs. Please ensure the voice has a name.");
      }
      synthesizerConfig = {
        provider: "elevenlabs",
        provider_config: {
          voice: voiceName, // Voice name (string)
          voice_id: (agentData as any).voiceId, // Unique voice ID
          model: "eleven_turbo_v2_5",
          // Note: sampling_rate is not a standard ElevenLabs field
        },
        stream: true,
        audio_format: "wav",
        buffer_size: 400,
      };
    } else if (voiceProvider === "polly") {
      synthesizerConfig = {
        provider: "polly",
        provider_config: {
          voice: (agentData as any).voiceId,
          engine: "generative",
          sampling_rate: "8000",
          language: (agentData as any).language || "en-US",
        },
        stream: true,
        audio_format: "wav",
        buffer_size: 150,
      };
    } else {
      // Default config for other providers
      synthesizerConfig = {
        provider: voiceProvider,
        provider_config: {
          voice: (agentData as any).voiceId,
          language: (agentData as any).language || "en-US",
        },
        stream: true,
        audio_format: "wav",
        buffer_size: 400,
      };
    }

    // Build minimal required config for Bolna v2 API
    // Use agent's webhookUrl if provided, otherwise fall back to env variable or default
    let webhookUrl: string | null = null;
    if ((agentData as any).webhookUrl) {
      webhookUrl = this.normalizeWebhookUrl((agentData as any).webhookUrl);
    } else {
      const envUrl = process.env.PUBLIC_WEBHOOK_URL || "https://platform.automitra.ai";
      const baseUrl = this.normalizeWebhookUrl(envUrl);
      webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/bolna/call-status` : null;
    }

    // CRITICAL: Ensure webhook URL is always set for real-time updates
    if (!webhookUrl) {
      console.warn(`[Bolna] ⚠️  WARNING: No webhook URL configured! Real-time updates will not work.`);
      console.warn(`[Bolna] Set PUBLIC_WEBHOOK_URL in .env to enable webhooks.`);
    } else {
      console.log(`[Bolna] ✅ Webhook URL configured for agent ${agentData.name}:`, webhookUrl);
      console.log(`[Bolna] This webhook will receive: status, duration, transcription, recording_url, cost`);
    }

    // Construct API tools if call forwarding is enabled
    let apiTools = null;
    if ((agentData as any).callForwardingEnabled && (agentData as any).callForwardingNumber) {
      console.log('[Bolna] Call forwarding enabled, adding transferCall tool');
      apiTools = {
        "tools": [{
          "type": "function",
          "function": {
            "name": "transferCall",
            "description": "Transfer the call to a human agent or another department",
            "parameters": {
              "type": "object",
              "properties": {
                "reason": {
                  "type": "string",
                  "description": "Reason for transferring the call"
                }
              },
              "required": ["reason"]
            }
          }
        }]
      };
    }

    // Build LLM config - support knowledge base if knowledgeBaseIds provided
    let llmAgentConfig: any = {
      agent_type: "simple_llm_agent",
      agent_flow_type: "streaming",
      llm_config: {
        agent_flow_type: "streaming",
        provider: (agentData as any).provider || "openai",
        family: (agentData as any).provider || "openai",
        model: (agentData as any).model || "gpt-3.5-turbo",
        max_tokens: (agentData as any).maxTokens || 150,
        temperature: (agentData as any).temperature || 0.7,
        presence_penalty: 0,
        frequency_penalty: 0,
        base_url: "https://api.openai.com/v1",
        top_p: 0.9,
        min_p: 0.1,
        top_k: 0,
        request_json: true,
        summarization_details: null,
        extraction_details: null,
      },
    };

    // Add knowledge base support if knowledgeBaseIds provided
    if ((agentData as any).knowledgeBaseIds && Array.isArray((agentData as any).knowledgeBaseIds) && (agentData as any).knowledgeBaseIds.length > 0) {
      llmAgentConfig.agent_type = "knowledgebase_agent";
      llmAgentConfig.llm_config.vector_store = {
        provider: "lancedb",
        provider_config: {
          vector_ids: (agentData as any).knowledgeBaseIds, // Array of knowledge base UUIDs
        },
      };
    }

    // Build ingest_source_config if provided (for inbound calls)
    let ingestSourceConfig: any = undefined;
    if ((agentData as any).ingestSourceType) {
      ingestSourceConfig = {
        source_type: (agentData as any).ingestSourceType,
      };
      if ((agentData as any).ingestSourceType === "api") {
        ingestSourceConfig.source_url = (agentData as any).ingestSourceUrl;
        ingestSourceConfig.source_auth_token = (agentData as any).ingestSourceAuthToken;
      } else if ((agentData as any).ingestSourceType === "csv") {
        ingestSourceConfig.source_name = (agentData as any).ingestSourceName;
      } else if ((agentData as any).ingestSourceType === "google_sheet") {
        ingestSourceConfig.source_url = (agentData as any).ingestSourceUrl;
        ingestSourceConfig.source_name = (agentData as any).ingestSourceName;
      }
    }

    const config: BolnaAgentConfigV2 = {
      agent_config: {
        agent_name: agentData.name,
        agent_welcome_message: (agentData as any).firstMessage || "Hello! How can I help you today?",
        webhook_url: webhookUrl,
        agent_type: (agentData as any).agentType || "other",
        tasks: [
          {
            task_type: "conversation",
            tools_config: {
              llm_agent: llmAgentConfig,
              synthesizer: synthesizerConfig,
              transcriber: {
                provider: (agentData as any).transcriberProvider || "deepgram",
                model: (agentData as any).transcriberModel || "nova-2",
                language: (agentData as any).transcriberLanguage || ((agentData as any).language || "en").split('-')[0] || "en",
                stream: true,
                sampling_rate: (agentData as any).transcriberSamplingRate || 16000,
                encoding: "linear16",
                endpointing: (agentData as any).transcriberEndpointing || 100,
              },
              input: {
                provider: "plivo", // Always use Plivo (Exotel disabled)
                format: "wav",
              },
              output: {
                provider: "plivo", // Always use Plivo (Exotel disabled)
                format: "wav",
              },
              api_tools: apiTools,
            },
            toolchain: {
              execution: "parallel",
              pipelines: [["transcriber", "llm", "synthesizer"]],
            },
            task_config: {
              hangup_after_silence: (agentData as any).hangupAfterSilence || 10,
              incremental_delay: (agentData as any).incrementalDelay || 400,
              number_of_words_for_interruption: (agentData as any).numberOfWordsForInterruption || 2,
              hangup_after_LLMCall: (agentData as any).hangupAfterLLMCall || false,
              call_cancellation_prompt: (agentData as any).callCancellationPrompt || null,
              backchanneling: (agentData as any).backchanneling || false,
              backchanneling_message_gap: (agentData as any).backchannelingMessageGap || 5,
              backchanneling_start_delay: (agentData as any).backchannelingStartDelay || 5,
              ambient_noise: (agentData as any).ambientNoise || false,
              ambient_noise_track: (agentData as any).ambientNoiseTrack || "office-ambience",
              call_terminate: (agentData as any).maxDuration || 90,
              voicemail: (agentData as any).voicemail || false,
              inbound_limit: (agentData as any).inboundLimit !== undefined ? (agentData as any).inboundLimit : -1,
              whitelist_phone_numbers: null, // Per API: null or array of E.164 phone numbers
              disallow_unknown_numbers: (agentData as any).disallowUnknownNumbers || false,
            },
          },
        ],
        ...(ingestSourceConfig && { ingest_source_config: ingestSourceConfig }),
      },
    };

    // Build request with agent_prompts at top level (required by API)
    let systemPrompt = (agentData as any).systemPrompt || "You are a helpful AI voice assistant.";
    if ((agentData as any).callForwardingEnabled && (agentData as any).callForwardingNumber) {
      systemPrompt += `\n\nIf the user asks to speak to a human or if you cannot help them, use the transferCall tool to transfer the call to ${(agentData as any).callForwardingNumber}.`;
    }

    const request: BolnaAgentRequestV2 = {
      agent_config: config.agent_config,
      agent_prompts: {
        task_1: {
          system_prompt: systemPrompt
        }
      }
    };

    console.log('[Bolna] Sending config to Bolna API:', JSON.stringify(request, null, 2));
    console.log('[Bolna] Request payload size:', JSON.stringify(request).length, 'bytes');

    try {
      const response = await this.request<{ agent_id: string; agent_name: string; agent_type: string; created_at: string; updated_at: string }>("/v2/agent", {
        method: "POST",
        body: JSON.stringify(request),
      });
      console.log('[Bolna] Agent created successfully:', response);
      return response;
    } catch (error: any) {
      console.error('[Bolna] Failed to create agent. Payload sent:', JSON.stringify(request, null, 2));
      console.error('[Bolna] Error details:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update agent with raw Bolna configuration (for direct API updates)
   * Used by webhook sync scripts to update agents in Bolna API directly
   */
  async updateAgentRaw(agentId: string, config: any): Promise<any> {
    this.ensureConfigured();
    return await this.request(`/v2/agent/${agentId}`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  async updateAgent(agentId: string, updates: Partial<AiAgent>, existingAgentConfig: any = null): Promise<BolnaAgent> {
    // If we have a full config, do a full update
    // Check if we need to do a full update (PUT) or partial update (PATCH)
    // A full update is needed if we're changing core structure or providing a full config object

    // For now, let's use the logic that if bolnaConfig is provided in updates, use that full config
    if ((updates as any).bolnaConfig) {
      console.log(`[Bolna] Full update for agent ${agentId} (bolnaConfig present)`);
      return this.updateAgentFull(agentId, updates, (updates as any).bolnaConfig);
    }

    // Otherwise map individual fields to a partial update structure if possible, 
    // BUT Bolna API typically favors PUT for configuration changes. 
    // To safe, we'll fetch the existing config (if not provided), merge, and send a full update.

    console.log(`[Bolna] Update requested for agent ${agentId}`, JSON.stringify(updates, null, 2));

    let currentConfig = existingAgentConfig;
    if (!currentConfig) {
      try {
        currentConfig = await this.getAgent(agentId);
      } catch (err) {
        console.warn(`[Bolna] Could not fetch existing agent ${agentId}, creating fresh config`);
        currentConfig = {};
      }
    }

    // Determine if we need full update (PUT) or partial update (PATCH)
    // PUT is needed if updating: model, provider, temperature, maxTokens, maxDuration, language
    // or any task-related fields that require full tasks array
    const needsFullUpdate = !!(updates.model || updates.provider || updates.temperature !== undefined ||
      (updates as any).maxTokens !== undefined || (updates as any).maxDuration !== undefined || updates.language ||
      (updates as any).callForwardingEnabled !== undefined || (updates as any).callForwardingNumber);

    if (needsFullUpdate) {
      // Use PUT for full agent update (requires complete agent_config with tasks)
      return await this.updateAgentFull(agentId, updates, currentConfig);
    } else {
      // Use PATCH for partial updates (only specific fields)
      return await this.updateAgentPartial(agentId, updates, currentConfig);
    }
  }

  async updateAgentFull(
    agentId: string,
    updates: Partial<AiAgent>,
    existingAgentConfig: any
  ): Promise<BolnaAgent> {
    this.ensureConfigured();

    console.log(`[Bolna] Performing FULL update (PUT) for agent ${agentId}`, JSON.stringify(updates, null, 2));

    // 1. Extract base config from existing (if available) or create skeleton
    // The existing config from API might return { agent_config: {...} } or just the config object
    // We need to adhere strictly to V2 structure: { agent_config: {...}, agent_prompts: {...} }

    let baseAgentConfig: any = {};
    let baseAgentPrompts: any = {};

    // Helper to safely extract agent_config
    if (existingAgentConfig) {
      if (existingAgentConfig.agent_config) {
        baseAgentConfig = JSON.parse(JSON.stringify(existingAgentConfig.agent_config));
      } else if (existingAgentConfig.agent_name || existingAgentConfig.tasks) {
        // existingAgentConfig IS the agent_config
        baseAgentConfig = JSON.parse(JSON.stringify(existingAgentConfig));
      }

      if (existingAgentConfig.agent_prompts) {
        baseAgentPrompts = JSON.parse(JSON.stringify(existingAgentConfig.agent_prompts));
      }
    }

    // Ensure basics exist in base config
    if (!baseAgentConfig.tasks || !Array.isArray(baseAgentConfig.tasks) || baseAgentConfig.tasks.length === 0) {
      // Fallback skeleton if tasks missing
      baseAgentConfig.tasks = [{
        task_type: "conversation",
        tools_config: {
          llm_agent: { llm_config: {} },
          synthesizer: { provider_config: {} },
          transcriber: {}
        },
        task_config: {}
      }];
    }
    const task = baseAgentConfig.tasks[0]; // Primary task

    // 2. Apply Updates to Base Config
    if (updates.name) baseAgentConfig.agent_name = updates.name;
    if (updates.firstMessage) baseAgentConfig.agent_welcome_message = updates.firstMessage;

    // Webhook URL
    let webhookUrl: string | null = null;
    if ((updates as any).webhookUrl !== undefined) {
      webhookUrl = this.normalizeWebhookUrl((updates as any).webhookUrl || null);
    } else if (baseAgentConfig.webhook_url) {
      webhookUrl = this.normalizeWebhookUrl(baseAgentConfig.webhook_url);
    } else {
      const envUrl = process.env.PUBLIC_WEBHOOK_URL || "https://platform.automitra.ai";
      const baseUrl = this.normalizeWebhookUrl(envUrl);
      webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/bolna/call-status` : null;
    }
    baseAgentConfig.webhook_url = webhookUrl;

    // Update LLM Config
    const llmConfig = task.tools_config?.llm_agent?.llm_config || {};
    if (updates.model) llmConfig.model = updates.model;
    if (updates.provider) llmConfig.provider = updates.provider;
    if (updates.temperature !== undefined) llmConfig.temperature = updates.temperature;
    if ((updates as any).maxTokens !== undefined) llmConfig.max_tokens = (updates as any).maxTokens;

    // Ensure nested objects exist
    if (!task.tools_config) task.tools_config = {};
    if (!task.tools_config.llm_agent) task.tools_config.llm_agent = {};
    task.tools_config.llm_agent.llm_config = llmConfig;

    // Update Synthesizer (Voice)
    const updatesAny = updates as any;
    if (updatesAny.voiceId || updatesAny.voiceProvider) {
      let mainProvider = updatesAny.voiceProvider ||
        task.tools_config?.synthesizer?.provider ||
        "elevenlabs";

      if (mainProvider === 'all') mainProvider = "elevenlabs";

      const voiceId = updatesAny.voiceId || task.tools_config?.synthesizer?.provider_config?.voice_id;
      // Voice name might be in voiceName, or we use voiceId as fallback
      const voiceName = updatesAny.voiceName ||
        task.tools_config?.synthesizer?.provider_config?.voice ||
        voiceId;

      if (!task.tools_config.synthesizer) task.tools_config.synthesizer = {};

      task.tools_config.synthesizer.provider = mainProvider;

      // Provider specific config
      const providerConfig = task.tools_config.synthesizer.provider_config || {};

      if (mainProvider === "elevenlabs") {
        providerConfig.voice = voiceName;
        providerConfig.voice_id = voiceId;
        providerConfig.model = "eleven_turbo_v2_5";
        providerConfig.sampling_rate = "16000";
      } else if (mainProvider === "polly") {
        providerConfig.voice = voiceId;
        providerConfig.engine = "generative";
        providerConfig.sampling_rate = "8000";
      } else {
        providerConfig.voice = voiceId;
      }

      if (updates.language) {
        providerConfig.language = updates.language;
      }

      task.tools_config.synthesizer.provider_config = providerConfig;
    } else if (updates.language) {
      // Just updating language
      if (task.tools_config?.synthesizer?.provider_config) {
        task.tools_config.synthesizer.provider_config.language = updates.language;
      }
    }

    // 3. Handle System Prompts & Call Forwarding
    let finalSystemPrompt = updates.systemPrompt ||
      baseAgentPrompts.task_1?.system_prompt ||
      "You are a helpful AI voice assistant.";

    // Check if call forwarding enabled (either in updates or potentially implicitly if not disabled)
    // We rely on updates having the flags if they are being changed. 
    // If not in updates, we should technically check the DB, but here we process the updates object.
    // However, if needsFullUpdate is true, it likely means these changed.

    // Note: The logic in createAgent appends the instruction. 
    // To avoid duplication, we should check if it's already there or clean it. 
    // But simplest is to just append if enabled.

    // Check if call forwarding settings are in updates
    const cfEnabled = updatesAny.callForwardingEnabled;
    const cfNumber = updatesAny.callForwardingNumber;

    if (cfEnabled && cfNumber) {
      // Append instruction if not already present (basic check)
      if (!finalSystemPrompt.includes("transferCall")) {
        finalSystemPrompt += `\n\nIf the user asks to speak to a human or if you cannot help them, use the transferCall tool to transfer the call to ${cfNumber}.`;
      }

      // Add tool definition
      const transferTool = {
        "type": "function",
        "function": {
          "name": "transferCall",
          "description": "Transfer the call to a human agent or another department",
          "parameters": {
            "type": "object",
            "properties": {
              "reason": {
                "type": "string",
                "description": "Reason for transferring the call"
              }
            },
            "required": ["reason"]
          }
        }
      };

      // Add to api_tools
      if (!task.tools_config.api_tools) {
        task.tools_config.api_tools = { tools: [] };
      }
      // Ensure tools array exists
      if (!task.tools_config.api_tools.tools) {
        task.tools_config.api_tools.tools = [];
      }

      // Filter out existing transferCall tool to avoid duplicates, then add
      task.tools_config.api_tools.tools = task.tools_config.api_tools.tools.filter(
        (t: any) => t.function?.name !== 'transferCall'
      );
      task.tools_config.api_tools.tools.push(transferTool);

    } else if (cfEnabled === false) {
      // explicit disable, might want to remove tool? 
      // For now, if disabled, we just don't add the prompt instruction/tool.
      // If we are editing an existing agent, we might need to strip the tool/prompt.
      // This is complex without full parsing. 
      // Re-creating the prompt without the appendix is safe if we assume we constructed it.
      if (task.tools_config.api_tools?.tools) {
        task.tools_config.api_tools.tools = task.tools_config.api_tools.tools.filter(
          (t: any) => t.function?.name !== 'transferCall'
        );
      }
    }

    // 4. Construct Final Payload
    const request: BolnaAgentRequestV2 = {
      agent_config: baseAgentConfig,
      agent_prompts: {
        task_1: {
          system_prompt: finalSystemPrompt
        }
      }
    };

    console.log('[Bolna] Sending FULL update payload:', JSON.stringify(request, null, 2));

    try {
      const response = await this.request<BolnaAgent>(`/v2/agent/${agentId}`, {
        method: "PUT",
        body: JSON.stringify(request),
      });
      console.log('[Bolna] Agent updated successfully (PUT):', response);
      return response;
    } catch (error) {
      console.error(`Failed to update Bolna agent ${agentId}:`, error);
      throw error;
    }
  }

  // Partial agent update using PATCH - only specific fields
  private async updateAgentPartial(
    agentId: string,
    updates: Partial<AiAgent>,
    existingAgentConfig: any
  ): Promise<BolnaAgent> {
    // Use agent's webhookUrl if provided in updates, otherwise use existing, otherwise fall back to env variable
    let webhookUrl: string | null = null;
    if ((updates as any).webhookUrl !== undefined) {
      webhookUrl = this.normalizeWebhookUrl((updates as any).webhookUrl || null);
    } else if (existingAgentConfig?.agent_config?.webhook_url) {
      webhookUrl = this.normalizeWebhookUrl(existingAgentConfig.agent_config.webhook_url);
    } else if (process.env.PUBLIC_WEBHOOK_URL) {
      const baseUrl = this.normalizeWebhookUrl(process.env.PUBLIC_WEBHOOK_URL);
      webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/bolna/call-status` : null;
    }

    const config: Partial<BolnaAgentConfigV2> = {
      agent_config: {} as any,
    };

    if (updates.name) {
      config.agent_config!.agent_name = updates.name;
    }
    if (updates.firstMessage) {
      config.agent_config!.agent_welcome_message = updates.firstMessage;
    }

    // Always update webhook_url to ensure it's set
    config.agent_config!.webhook_url = webhookUrl;
    console.log(`[Bolna] Partial update webhook URL for agent ${agentId}:`, webhookUrl || 'none');
    if (updates.agentType) {
      config.agent_config!.agent_type = updates.agentType;
    }

    // Only update synthesizer if voiceId or voiceProvider is explicitly provided in updates
    const shouldUpdateSynthesizer = updates.voiceId !== undefined || updates.voiceProvider !== undefined;

    if (shouldUpdateSynthesizer) {
      // Get voiceId from updates - if not provided, try to extract from existing config
      let voiceId = updates.voiceId || (updates as any).voiceId;
      let voiceProvider = (updates.voiceProvider && updates.voiceProvider !== 'all')
        ? updates.voiceProvider
        : (updates as any).voiceProvider;

      // If voiceId not in updates, try to get from existing agent config
      if (!voiceId && existingAgentConfig) {
        try {
          const tasks = existingAgentConfig.agent_config?.tasks || [];
          if (tasks.length > 0) {
            const synthesizer = tasks[0]?.tools_config?.synthesizer;
            if (synthesizer?.provider_config?.voice_id) {
              voiceId = synthesizer.provider_config.voice_id;
              voiceProvider = synthesizer.provider || voiceProvider || "elevenlabs";
            } else if (synthesizer?.provider_config?.voice) {
              voiceId = synthesizer.provider_config.voice;
              voiceProvider = synthesizer.provider || voiceProvider || "elevenlabs";
            }
          }
        } catch (e) {
          console.warn(`[Bolna] Could not extract voiceId from existing config: ${(e as Error).message}`);
        }
      }

      // Default voiceProvider if still not set
      if (!voiceProvider || voiceProvider === 'all') {
        voiceProvider = "elevenlabs";
      }

      // PATCH supports updating synthesizer directly
      if (voiceId || voiceProvider) {
        if (!voiceId) {
          throw new Error("Voice ID is required when updating synthesizer. Please ensure the agent has a voice selected.");
        }

        let synthesizerConfig: any = null;
        if (voiceProvider === "elevenlabs") {
          synthesizerConfig = {
            provider: "elevenlabs",
            provider_config: {
              voice: voiceId,
              voice_id: voiceId,
              model: "eleven_turbo_v2_5",
              sampling_rate: "16000",
            },
            stream: true,
            audio_format: "wav",
            buffer_size: 400,
          };
        } else if (voiceProvider === "polly") {
          synthesizerConfig = {
            provider: "polly",
            provider_config: {
              voice: voiceId,
              engine: "generative",
              sampling_rate: "8000",
              language: updates.language || "en-US",
            },
            stream: true,
            audio_format: "wav",
            buffer_size: 150,
          };
        } else {
          synthesizerConfig = {
            provider: voiceProvider,
            provider_config: {
              voice: voiceId,
              language: updates.language || "en-US",
            },
            stream: true,
            audio_format: "wav",
            buffer_size: 400,
          };
        }

        (config.agent_config as any).synthesizer = synthesizerConfig;
      }
    }

    // Build PATCH request - agent_prompts must be at top level per API spec
    const patchRequest: any = {
      agent_config: config.agent_config
    };

    // Include agent_prompts if systemPrompt is being updated
    if (updates.systemPrompt || (updates.callForwardingEnabled && updates.callForwardingNumber) || patchRequest.agent_config.synthesizer) {
      let systemPrompt = updates.systemPrompt;

      if (!systemPrompt && existingAgentConfig?.agent_prompts?.task_1?.system_prompt) {
        systemPrompt = existingAgentConfig.agent_prompts.task_1.system_prompt;
      }

      if (!systemPrompt) {
        systemPrompt = "You are a helpful AI voice assistant.";
      }

      if (updates.callForwardingEnabled && updates.callForwardingNumber) {
        systemPrompt += `\n\nIf the user asks to speak to a human or if you cannot help them, use the transferCall tool to transfer the call to ${updates.callForwardingNumber}.`;
      }

      patchRequest.agent_prompts = {
        task_1: {
          system_prompt: systemPrompt,
        },
      };
    }

    console.log('[Bolna] PATCH request payload (partial update):', JSON.stringify(patchRequest, null, 2));

    return await this.request<BolnaAgent>(`/v2/agent/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(patchRequest),
    });
  }

  /**
   * Delete an agent from Bolna
   * WARNING: This deletes ALL agent data including all batches, all executions, etc.
   * 
   * @param agentId - The Bolna agent ID (UUID)
   * @returns Promise that resolves when agent is deleted
   * @throws Error if deletion fails
   * 
   * API Reference: DELETE /v2/agent/{agent_id}
   * Response: { message: "success", state: "deleted" }
   */
  async deleteAgent(agentId: string): Promise<{ message: string; state: string }> {
    this.ensureConfigured();
    const response = await this.request<{ message: string; state: string }>(`/v2/agent/${agentId}`, {
      method: "DELETE",
    });
    return response;
  }

  async getAgent(agentId: string): Promise<BolnaAgent> {
    this.ensureConfigured();
    return await this.request<BolnaAgent>(`/v2/agent/${agentId}`);
  }

  async listAgents(): Promise<BolnaAgent[]> {
    this.ensureConfigured();
    // Try v2 first, fallback to v1
    try {
      const response = await this.request<{ agents?: BolnaAgent[] } | BolnaAgent[]>("/v2/agents");
      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object' && 'agents' in response) {
        return (response as any).agents || [];
      }
      return [];
    } catch (error) {
      // Fallback to v1
      const response = await this.request<{ agents: BolnaAgent[] }>("/v1/agents");
      return response.agents || [];
    }
  }



  async getCallStatus(callId: string): Promise<any> {
    this.ensureConfigured();
    return await this.request<any>(`/v1/calls/${callId}`);
  }

  async getCallTranscript(callId: string): Promise<string> {
    this.ensureConfigured();
    const response = await this.request<{ transcript: string }>(
      `/v1/calls/${callId}/transcript`
    );
    return response.transcript;
  }

  async getCallDetails(callId: string): Promise<{ transcript?: string; recording_url?: string; status?: string; duration?: number }> {
    this.ensureConfigured();

    const endpoints = [
      `/call/${callId}`,           // Main endpoint
      `/v2/call/${callId}`,         // V2 endpoint
      `/agent/execution/${callId}`, // Execution endpoint
      `/calls/${callId}`,           // Alternative calls endpoint
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`[Bolna] Trying endpoint: ${endpoint}`);
        const response = await this.request<any>(endpoint);

        console.log(`[Bolna] ✓ Success with ${endpoint}:`, JSON.stringify(response, null, 2));

        // Extract data from various possible field names
        const transcript = response.transcript ||
          response.transcription ||
          response.conversation_transcript ||
          response.messages?.map((m: any) => `${m.role}: ${m.content}`).join('\n') ||
          response.conversation?.map((c: any) => `${c.speaker}: ${c.text}`).join('\n');

        const recording_url = response.recording_url ||
          response.recordingUrl ||
          response.recording ||
          response.audio_url ||
          response.call_recording;

        const status = response.status ||
          response.call_status ||
          response.state;

        const duration = response.duration ||
          response.call_duration ||
          response.length;

        if (transcript || recording_url || status) {
          return {
            transcript,
            recording_url,
            status,
            duration
          };
        }
      } catch (error: any) {
        console.log(`[Bolna] ✗ Failed with ${endpoint}: ${error.message}`);
        continue; // Try next endpoint
      }
    }

    // If all endpoints fail, try to get transcript and recording separately
    console.log(`[Bolna] Trying separate transcript/recording endpoints for ${callId}`);
    const result: any = {};

    try {
      const transcriptResp = await this.request<any>(`/call/${callId}/transcript`);
      result.transcript = transcriptResp.transcript || transcriptResp.text || transcriptResp.content;
    } catch (e) {
      console.log(`[Bolna] No transcript available`);
    }

    try {
      const recordingResp = await this.request<any>(`/call/${callId}/recording`);
      result.recording_url = recordingResp.recording_url || recordingResp.url || recordingResp.audio_url;
    } catch (e) {
      console.log(`[Bolna] No recording available`);
    }

    return result;
  }

  async getAvailableVoices(): Promise<BolnaVoice[]> {
    this.ensureConfigured();
    try {
      // Use Bolna's correct endpoint: GET /me/voices
      const response = await this.request<BolnaVoice[] | { data?: BolnaVoice[]; voices?: BolnaVoice[] }>("/me/voices");
      // Handle both array and object responses
      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object') {
        // Check for 'data' field (Bolna v2 format)
        if ('data' in response && Array.isArray((response as any).data)) {
          return (response as any).data;
        }
        // Check for 'voices' field (alternative format)
        if ('voices' in response && Array.isArray((response as any).voices)) {
          return (response as any).voices;
        }
      }
      return [];
    } catch (error) {
      console.error("Error fetching Bolna voices:", error);
      return [];
    }
  }

  async getAvailableModels(): Promise<BolnaModel[]> {
    this.ensureConfigured();

    try {
      // Try to fetch models from Bolna API
      // Try multiple possible endpoints
      const endpoints = [
        "/me/models",
        "/models",
        "/user/models",
        "/v2/models",
        "/v1/models",
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[Bolna] Trying models endpoint: ${endpoint}`);
          const response = await this.request<any>(endpoint);

          // Handle different response formats
          if (Array.isArray(response)) {
            console.log(`[Bolna] ✓ Found ${response.length} models from ${endpoint}`);
            return response.map((m: any) => ({
              model: m.model || m.name || m.id,
              provider: m.provider || m.family,
              family: m.family || m.provider,
              description: m.description || `${m.provider || 'Unknown'} model`,
            }));
          }

          if (response && typeof response === 'object') {
            // Check for 'data' field
            if ('data' in response && Array.isArray((response as any).data)) {
              console.log(`[Bolna] ✓ Found ${(response as any).data.length} models from ${endpoint}`);
              return (response as any).data.map((m: any) => ({
                model: m.model || m.name || m.id,
                provider: m.provider || m.family,
                family: m.family || m.provider,
                description: m.description || `${m.provider || 'Unknown'} model`,
              }));
            }

            // Check for 'models' field
            if ('models' in response && Array.isArray((response as any).models)) {
              console.log(`[Bolna] ✓ Found ${(response as any).models.length} models from ${endpoint}`);
              return (response as any).models.map((m: any) => ({
                model: m.model || m.name || m.id,
                provider: m.provider || m.family,
                family: m.family || m.provider,
                description: m.description || `${m.provider || 'Unknown'} model`,
              }));
            }
          }
        } catch (error: any) {
          console.log(`[Bolna] ✗ Failed with ${endpoint}: ${error.message}`);
          continue; // Try next endpoint
        }
      }

      // If all endpoints fail, return curated list as fallback
      console.warn("[Bolna] Could not fetch models from API, using fallback list");
      return [
        // OpenAI Models
        { model: "gpt-4o", provider: "openai", family: "openai", description: "Most advanced GPT-4 model" },
        { model: "gpt-4o-mini", provider: "openai", family: "openai", description: "Faster, more affordable GPT-4" },
        { model: "gpt-4-turbo", provider: "openai", family: "openai", description: "GPT-4 Turbo with Vision" },
        { model: "gpt-4", provider: "openai", family: "openai", description: "GPT-4 base model" },
        { model: "gpt-3.5-turbo", provider: "openai", family: "openai", description: "Fast and efficient" },

        // Anthropic Models
        { model: "claude-3-5-sonnet-20241022", provider: "anthropic", family: "anthropic", description: "Most capable Claude model" },
        { model: "claude-3-opus-20240229", provider: "anthropic", family: "anthropic", description: "Claude Opus" },
        { model: "claude-3-sonnet-20240229", provider: "anthropic", family: "anthropic", description: "Claude Sonnet" },
        { model: "claude-3-haiku-20240307", provider: "anthropic", family: "anthropic", description: "Fast Claude model" },

        // Google Models
        { model: "gemini-1.5-pro", provider: "google", family: "google", description: "Advanced Gemini Pro" },
        { model: "gemini-1.5-flash", provider: "google", family: "google", description: "Fast Gemini model" },
        { model: "gemini-pro", provider: "google", family: "google", description: "Gemini Pro" },

        // Meta Models  
        { model: "llama-3.1-70b-instruct", provider: "meta", family: "meta", description: "Llama 3.1 70B" },
        { model: "llama-3.1-8b-instruct", provider: "meta", family: "meta", description: "Llama 3.1 8B" },
        { model: "llama-3-70b-instruct", provider: "meta", family: "meta", description: "Llama 3 70B" },
        { model: "llama-3-8b-instruct", provider: "meta", family: "meta", description: "Llama 3 8B" },

        // Mistral Models
        { model: "mistral-large-latest", provider: "mistral", family: "mistral", description: "Mistral Large" },
        { model: "mistral-medium-latest", provider: "mistral", family: "mistral", description: "Mistral Medium" },
        { model: "mistral-small-latest", provider: "mistral", family: "mistral", description: "Mistral Small" },
      ];
    } catch (error) {
      console.error("Error fetching Bolna models:", error);
      // Return fallback list on error
      return [
        { model: "gpt-4o", provider: "openai", family: "openai", description: "Most advanced GPT-4 model" },
        { model: "gpt-4o-mini", provider: "openai", family: "openai", description: "Faster, more affordable GPT-4" },
        { model: "gpt-4-turbo", provider: "openai", family: "openai", description: "GPT-4 Turbo with Vision" },
        { model: "gpt-4", provider: "openai", family: "openai", description: "GPT-4 base model" },
        { model: "gpt-3.5-turbo", provider: "openai", family: "openai", description: "Fast and efficient" },
        { model: "claude-3-5-sonnet-20241022", provider: "anthropic", family: "anthropic", description: "Most capable Claude model" },
        { model: "claude-3-opus-20240229", provider: "anthropic", family: "anthropic", description: "Claude Opus" },
        { model: "claude-3-sonnet-20240229", provider: "anthropic", family: "anthropic", description: "Claude Sonnet" },
        { model: "claude-3-haiku-20240307", provider: "anthropic", family: "anthropic", description: "Fast Claude model" },
        { model: "gemini-1.5-pro", provider: "google", family: "google", description: "Advanced Gemini Pro" },
        { model: "gemini-1.5-flash", provider: "google", family: "google", description: "Fast Gemini model" },
        { model: "gemini-pro", provider: "google", family: "google", description: "Gemini Pro" },
      ];
    }
  }

  // Knowledge Base Management
  async createKnowledgeBase(file: File | Buffer | any, options?: {
    chunk_size?: number;
    similarity_top_k?: number;
    overlapping?: number;
    fileName?: string;
  }): Promise<BolnaKnowledgeBase> {
    this.ensureConfigured();

    // Use form-data package
    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    if (options?.chunk_size) formData.append('chunk_size', options.chunk_size.toString());
    if (options?.similarity_top_k) formData.append('similarity_top_k', options.similarity_top_k.toString());
    if (options?.overlapping) formData.append('overlapping', options.overlapping.toString());

    if (Buffer.isBuffer(file)) {
      formData.append('file', file, options?.fileName || 'file');
    } else if (file && typeof file === 'object' && 'buffer' in file) {
      // Handle multer file object
      formData.append('file', file.buffer, file.originalname || options?.fileName || 'file');
    } else {
      console.error('[Bolna] Invalid file type for KB creation:', typeof file);
      throw new Error('Invalid file type. Expected Buffer or multer file object.');
    }

    const url = `${this.baseUrl}/knowledgebase`;

    // Switch to axios for better multipart/form-data handling in Node environment
    const axios = (await import('axios')).default;

    try {
      console.log(`[Bolna] Uploading KB to ${url} with headers:`, {
        ...formData.getHeaders(),
        Authorization: 'Bearer [REDACTED]'
      });

      const response = await axios.post(url, formData, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return response.data;
    } catch (error: any) {
      console.error('[Bolna] KB Creation Failed:', error.response?.data || error.message);
      throw new Error(`Bolna API error: ${JSON.stringify(error.response?.data || error.message)}`);
    }
  }

  /**
   * Create a knowledgebase from a URL
   * The URL will be scraped and ingested as a knowledgebase
   */
  async createKnowledgeBaseFromUrl(url: string, options?: {
    chunk_size?: number;
    similarity_top_k?: number;
    overlapping?: number;
  }): Promise<BolnaKnowledgeBase> {
    this.ensureConfigured();

    // Use form-data package for Node.js FormData support
    // @ts-ignore
    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    // Add URL parameter
    formData.append('url', url);

    if (options?.chunk_size) formData.append('chunk_size', options.chunk_size.toString());
    if (options?.similarity_top_k) formData.append('similarity_top_k', options.similarity_top_k.toString());
    if (options?.overlapping) formData.append('overlapping', options.overlapping.toString());

    const apiUrl = `${this.baseUrl}/knowledgebase`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.apiKey}`,
      ...formData.getHeaders(),
    };

    console.log(`[Bolna] Creating knowledgebase from URL: ${url}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bolna API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`[Bolna] Knowledgebase created from URL:`, result);
    return result;
  }

  /**
   * Create a knowledgebase from agent data
   * Accumulates all agent information into a PDF document and uploads it
   */
  async createAgentKnowledgeBase(agentData: {
    name: string;
    description?: string;
    systemPrompt?: string;
    firstMessage?: string;
    userPrompt?: string;
    customData?: Record<string, any>;
    additionalInfo?: string;
  }): Promise<BolnaKnowledgeBase> {
    this.ensureConfigured();

    // Generate a text document from agent data
    const documentContent = this.generateAgentDocument(agentData);

    // Convert to Buffer (plain text file)
    const buffer = Buffer.from(documentContent, 'utf-8');

    // For Bolna, we need to send as PDF. Since we have text, let's convert using a simple approach
    // Use PDFKit to generate a proper PDF
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const result = await this.createKnowledgeBase(pdfBuffer, {
            fileName: `${agentData.name.replace(/[^a-zA-Z0-9]/g, '_')}_knowledge.pdf`,
            chunk_size: 512,
            similarity_top_k: 15,
            overlapping: 128,
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      doc.on('error', reject);

      // Write content to PDF
      doc.fontSize(18).text(`Agent Knowledge Base: ${agentData.name}`, { align: 'center' });
      doc.moveDown(2);

      if (agentData.description) {
        doc.fontSize(14).text('Description:', { underline: true });
        doc.fontSize(12).text(agentData.description);
        doc.moveDown();
      }

      if (agentData.systemPrompt) {
        doc.fontSize(14).text('System Instructions:', { underline: true });
        doc.fontSize(10).text(agentData.systemPrompt);
        doc.moveDown();
      }

      if (agentData.firstMessage) {
        doc.fontSize(14).text('Welcome Message:', { underline: true });
        doc.fontSize(12).text(agentData.firstMessage);
        doc.moveDown();
      }

      if (agentData.userPrompt) {
        doc.fontSize(14).text('User Prompt Template:', { underline: true });
        doc.fontSize(10).text(agentData.userPrompt);
        doc.moveDown();
      }

      if (agentData.additionalInfo) {
        doc.fontSize(14).text('Additional Information:', { underline: true });
        doc.fontSize(10).text(agentData.additionalInfo);
        doc.moveDown();
      }

      if (agentData.customData && Object.keys(agentData.customData).length > 0) {
        doc.fontSize(14).text('Custom Data:', { underline: true });
        doc.fontSize(10).text(JSON.stringify(agentData.customData, null, 2));
        doc.moveDown();
      }

      doc.end();
    });
  }

  /**
   * Generate a text document from agent data
   */
  private generateAgentDocument(agentData: {
    name: string;
    description?: string;
    systemPrompt?: string;
    firstMessage?: string;
    userPrompt?: string;
    customData?: Record<string, any>;
    additionalInfo?: string;
  }): string {
    const lines: string[] = [];

    lines.push(`# Agent Knowledge Base: ${agentData.name}`);
    lines.push('');

    if (agentData.description) {
      lines.push('## Description');
      lines.push(agentData.description);
      lines.push('');
    }

    if (agentData.systemPrompt) {
      lines.push('## System Instructions');
      lines.push(agentData.systemPrompt);
      lines.push('');
    }

    if (agentData.firstMessage) {
      lines.push('## Welcome Message');
      lines.push(agentData.firstMessage);
      lines.push('');
    }

    if (agentData.userPrompt) {
      lines.push('## User Prompt Template');
      lines.push(agentData.userPrompt);
      lines.push('');
    }

    if (agentData.additionalInfo) {
      lines.push('## Additional Information');
      lines.push(agentData.additionalInfo);
      lines.push('');
    }

    if (agentData.customData && Object.keys(agentData.customData).length > 0) {
      lines.push('## Custom Data');
      lines.push(JSON.stringify(agentData.customData, null, 2));
      lines.push('');
    }

    return lines.join('\n');
  }

  async getKnowledgeBase(ragId: string): Promise<BolnaKnowledgeBase> {
    this.ensureConfigured();
    return await this.request<BolnaKnowledgeBase>(`/knowledgebase/${ragId}`);
  }

  async listKnowledgeBases(): Promise<BolnaKnowledgeBase[]> {
    this.ensureConfigured();
    try {
      const response = await this.request<BolnaKnowledgeBase[] | { knowledge_bases?: BolnaKnowledgeBase[] }>("/knowledgebase/all");
      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object' && 'knowledge_bases' in response) {
        return Array.isArray((response as any).knowledge_bases) ? (response as any).knowledge_bases : [];
      }
      return [];
    } catch (error) {
      console.error("Error fetching knowledge bases:", error);
      return [];
    }
  }

  /**
   * Delete a knowledgebase by its rag_id
   * API Reference: DELETE /knowledgebase/{rag_id}
   */
  async deleteKnowledgeBase(ragId: string): Promise<BolnaKnowledgeBaseDeleteResponse> {
    this.ensureConfigured();
    console.log(`[Bolna] Deleting knowledgebase: ${ragId}`);
    const response = await this.request<BolnaKnowledgeBaseDeleteResponse>(`/knowledgebase/${ragId}`, {
      method: "DELETE",
    });
    console.log(`[Bolna] Knowledgebase deleted:`, response);
    return response;
  }

  /**
   * Attach a knowledgebase to an agent by updating the agent's llm_config with rag_config
   * For knowledgebase_agent, the rag_id needs to be added to used_sources array
   * Uses PUT /v2/agent/{agent_id} to update the full agent config
   */
  async attachKnowledgeBaseToAgent(agentId: string, ragId: string): Promise<any> {
    this.ensureConfigured();
    console.log(`[Bolna] Attaching knowledgebase ${ragId} to agent ${agentId}`);
    
    // Get current agent config from V2 API
    const agentResponse: any = await this.request<any>(`/v2/agent/${agentId}`);
    if (!agentResponse) {
      throw new Error(`Agent ${agentId} not found`);
    }

    console.log(`[Bolna] Current agent structure:`, JSON.stringify(agentResponse, null, 2));

    // Get the knowledgebase info to get vector_id
    let kbInfo: BolnaKnowledgeBase | null = null;
    try {
      kbInfo = await this.getKnowledgeBase(ragId);
    } catch (e) {
      console.warn(`[Bolna] Could not fetch KB info for ${ragId}:`, (e as Error).message);
    }

    // V2 API returns tasks at root level
    const tasks = agentResponse.tasks || [];
    
    // Build updated tasks with knowledge base config
    const updatedTasks = tasks.map((task: any) => {
      if (task.task_type === 'conversation') {
        const llmAgent = task.tools_config?.llm_agent || {};
        const llmConfig = llmAgent.llm_config || {};
        
        // Get existing rag_config or create new one
        const existingRagConfig = llmConfig.rag_config || {};
        const existingUsedSources = existingRagConfig.used_sources || [];
        
        // Check if this KB is already attached
        const alreadyAttached = existingUsedSources.some((s: any) => s.rag_id === ragId);
        if (alreadyAttached) {
          console.log(`[Bolna] KB ${ragId} already attached to agent ${agentId}`);
          return task;
        }
        
        // Create new source entry
        const newSource = {
          rag_id: ragId,
          vector_id: kbInfo?.vector_id || ragId,
          source: kbInfo?.file_name || kbInfo?.name || ragId,
        };
        
        // Update llm_config with new rag_config
        const updatedLlmConfig = {
          ...llmConfig,
          rag_config: {
            ...existingRagConfig,
            used_sources: [...existingUsedSources, newSource],
            vector_store: existingRagConfig.vector_store || {
              provider: "bolna",
              provider_config: {
                vector_ids: [...(existingRagConfig.vector_store?.provider_config?.vector_ids || []), kbInfo?.vector_id || ragId],
              },
            },
          },
        };
        
        // For proper knowledge base support, change agent_type to knowledgebase_agent
        // Only if it's currently simple_llm_agent
        const updatedAgentType = llmAgent.agent_type === 'simple_llm_agent' && existingUsedSources.length === 0
          ? 'knowledgebase_agent'
          : llmAgent.agent_type;
        
        return {
          ...task,
          tools_config: {
            ...task.tools_config,
            llm_agent: {
              ...llmAgent,
              agent_type: updatedAgentType,
              llm_config: updatedLlmConfig,
            },
          },
        };
      }
      return task;
    });

    // Build the full agent update payload for V2 PUT API
    const updatePayload = {
      agent_config: {
        agent_name: agentResponse.agent_name,
        agent_type: agentResponse.agent_type || 'other',
        agent_welcome_message: agentResponse.agent_welcome_message || '',
        webhook_url: agentResponse.webhook_url || null,
        tasks: updatedTasks,
        ingest_source_config: agentResponse.ingest_source_config || null,
      },
      agent_prompts: agentResponse.agent_prompts || { task_1: { system_prompt: '' } },
    };

    console.log(`[Bolna] Updating agent with payload:`, JSON.stringify(updatePayload, null, 2));

    // Use PUT to update the agent with the new config
    const response = await this.request<any>(`/v2/agent/${agentId}`, {
      method: "PUT",
      body: JSON.stringify(updatePayload),
    });

    console.log(`[Bolna] Knowledgebase attached to agent:`, response);
    return response;
  }

  /**
   * Detach a knowledgebase from an agent
   * Removes the rag_id from the agent's used_sources array
   */
  async detachKnowledgeBaseFromAgent(agentId: string, ragId: string): Promise<any> {
    this.ensureConfigured();
    console.log(`[Bolna] Detaching knowledgebase ${ragId} from agent ${agentId}`);
    
    // Get current agent config from V2 API
    const agentResponse: any = await this.request<any>(`/v2/agent/${agentId}`);
    if (!agentResponse) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // V2 API returns tasks at root level
    const tasks = agentResponse.tasks || [];
    
    // Build updated tasks without the knowledge base
    const updatedTasks = tasks.map((task: any) => {
      if (task.task_type === 'conversation') {
        const llmAgent = task.tools_config?.llm_agent || {};
        const llmConfig = llmAgent.llm_config || {};
        
        // Get existing rag_config
        const existingRagConfig = llmConfig.rag_config || {};
        const existingUsedSources = existingRagConfig.used_sources || [];
        const existingVectorIds = existingRagConfig.vector_store?.provider_config?.vector_ids || [];
        
        // Remove the KB from used_sources
        const filteredUsedSources = existingUsedSources.filter((s: any) => s.rag_id !== ragId);
        
        // Remove from vector_ids as well
        const filteredVectorIds = existingVectorIds.filter((id: string) => {
          const source = existingUsedSources.find((s: any) => s.rag_id === ragId);
          return id !== (source?.vector_id || ragId);
        });
        
        // If no more knowledge bases, revert to simple_llm_agent
        const updatedAgentType = filteredUsedSources.length === 0 && llmAgent.agent_type === 'knowledgebase_agent'
          ? 'simple_llm_agent'
          : llmAgent.agent_type;
        
        // Update llm_config with removed KB
        const updatedLlmConfig = {
          ...llmConfig,
          rag_config: filteredUsedSources.length > 0 ? {
            ...existingRagConfig,
            used_sources: filteredUsedSources,
            vector_store: {
              ...existingRagConfig.vector_store,
              provider_config: {
                ...existingRagConfig.vector_store?.provider_config,
                vector_ids: filteredVectorIds,
              },
            },
          } : undefined,
        };
        
        // Clean up undefined rag_config
        if (!updatedLlmConfig.rag_config) {
          delete updatedLlmConfig.rag_config;
        }
        
        return {
          ...task,
          tools_config: {
            ...task.tools_config,
            llm_agent: {
              ...llmAgent,
              agent_type: updatedAgentType,
              llm_config: updatedLlmConfig,
            },
          },
        };
      }
      return task;
    });

    // Build the full agent update payload for V2 PUT API
    const updatePayload = {
      agent_config: {
        agent_name: agentResponse.agent_name,
        agent_type: agentResponse.agent_type || 'other',
        agent_welcome_message: agentResponse.agent_welcome_message || '',
        webhook_url: agentResponse.webhook_url || null,
        tasks: updatedTasks,
        ingest_source_config: agentResponse.ingest_source_config || null,
      },
      agent_prompts: agentResponse.agent_prompts || { task_1: { system_prompt: '' } },
    };

    console.log(`[Bolna] Updating agent with payload:`, JSON.stringify(updatePayload, null, 2));

    // Use PUT to update the agent with the new config
    const response = await this.request<any>(`/v2/agent/${agentId}`, {
      method: "PUT",
      body: JSON.stringify(updatePayload),
    });

    console.log(`[Bolna] Knowledgebase detached from agent:`, response);
    return response;
  }

  // Helper: Get Bolna phone number ID by phone number string
  async getPhoneNumberIdByPhoneNumber(phoneNumber: string): Promise<string | null> {
    this.ensureConfigured();
    try {
      const registeredNumbers = await this.listRegisteredPhoneNumbers();
      const found = registeredNumbers.find(n => n.phone_number === phoneNumber);
      return found?.id || null;
    } catch (error) {
      console.error(`Failed to find phone number ID for ${phoneNumber}:`, error);
      return null;
    }
  }

  // Inbound Setup
  // According to Bolna API: expects phone_number_id (UUID) not phone_number (string)
  // If phoneNumberOrId looks like a UUID, use it directly; otherwise, look it up
  async setupInboundCall(agentId: string, phoneNumberOrId: string): Promise<any> {
    this.ensureConfigured();

    // Check if it's already a UUID (phone_number_id format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let phoneNumberId: string;

    if (uuidRegex.test(phoneNumberOrId)) {
      // It's already a UUID, use it directly
      phoneNumberId = phoneNumberOrId;
    } else {
      // It's a phone number string, look up the ID
      const foundId = await this.getPhoneNumberIdByPhoneNumber(phoneNumberOrId);
      if (!foundId) {
        throw new Error(`Phone number ${phoneNumberOrId} not found in Bolna registered numbers. Please register it first.`);
      }
      phoneNumberId = foundId;
    }

    return await this.request("/inbound/setup", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        phone_number_id: phoneNumberId,
      }),
    });
  }

  // Inbound Unlink - Remove agent from inbound calls
  // According to Bolna API: POST /inbound/unlink with phone_number_id
  async unlinkInboundCall(phoneNumberOrId: string): Promise<any> {
    this.ensureConfigured();
    
    // Check if it's already a UUID (phone_number_id format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let phoneNumberId: string;
    
    if (uuidRegex.test(phoneNumberOrId)) {
      // It's already a UUID, use it directly
      phoneNumberId = phoneNumberOrId;
    } else {
      // It's a phone number string, look up the ID
      const foundId = await this.getPhoneNumberIdByPhoneNumber(phoneNumberOrId);
      if (!foundId) {
        throw new Error(`Phone number ${phoneNumberOrId} not found in Bolna registered numbers.`);
      }
      phoneNumberId = foundId;
    }
    
    return await this.request("/inbound/unlink", {
      method: "POST",
      body: JSON.stringify({
        phone_number_id: phoneNumberId,
      }),
    });
  }

  // Call Management
  async stopAgentCalls(agentId: string): Promise<any> {
    this.ensureConfigured();
    return await this.request(`/v2/agent/${agentId}/stop`, {
      method: "POST",
    });
  }

  async stopCall(executionId: string): Promise<any> {
    this.ensureConfigured();
    return await this.request(`/call/${executionId}/stop`, {
      method: "POST",
    });
  }

  async getAgentExecution(agentId: string, executionId: string): Promise<any> {
    this.ensureConfigured();
    return await this.request(`/agent/${agentId}/execution/${executionId}`);
  }

  /**
   * Get all executions (calls) for an agent
   * API Reference: GET /agent/{agent_id}/executions
   */
  async getAgentExecutions(agentId: string, page: number = 1, limit: number = 100): Promise<{ executions: any[]; Count: number }> {
    this.ensureConfigured();
    try {
      const response = await this.request<{ executions?: any[]; Count?: number } | any[]>(
        `/agent/${agentId}/executions?page=${page}&limit=${limit}`
      );
      
      // Handle different response formats
      if (Array.isArray(response)) {
        return { executions: response, Count: response.length };
      }
      
      return {
        executions: response.executions || [],
        Count: response.Count || 0
      };
    } catch (error: any) {
      console.error(`[Bolna] Error fetching executions for agent ${agentId}:`, error.message);
      return { executions: [], Count: 0 };
    }
  }

  // Enhanced call initiation with v2 features


  // ============================================
  // BATCH API METHODS
  // ============================================

  /**
   * Create a batch for bulk calling
   * API Reference: POST /batches
   * 
   * @param params.agent_id - The Bolna agent ID to use for calls
   * @param params.file - CSV file buffer or FormData with contacts
   * @param params.from_phone_number - Outbound phone number (E.164 format)
   * @param params.webhook_url - Optional webhook for batch status updates
   * @returns Batch creation response with batch_id
   */
  async createBatch(params: {
    agent_id: string;
    file: Buffer;
    fileName: string;
    from_phone_number: string;
    webhook_url?: string;
  }): Promise<{
    batch_id: string;
    file_name: string;
    valid_contacts: number;
    total_contacts: number;
    state: string;
    created_at: string;
  }> {
    this.ensureConfigured();

    // Create form data for file upload
    const formData = new FormData();
    const blob = new Blob([params.file as any], { type: 'text/csv' });
    formData.append('file', blob, params.fileName);
    formData.append('agent_id', params.agent_id);
    formData.append('from_phone_number', params.from_phone_number);
    if (params.webhook_url) {
      formData.append('webhook_url', params.webhook_url);
    }

    const response = await fetch(`${this.baseUrl}/batches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bolna batch creation failed (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Schedule a batch to run at a specific time
   * API Reference: POST /batches/{batch_id}/schedule
   * 
   * @param batchId - The batch ID to schedule
   * @param scheduledAt - ISO 8601 timestamp for when to run the batch
   * @returns Scheduled batch details
   */
  async scheduleBatch(batchId: string, scheduledAt: string): Promise<{
    batch_id: string;
    file_name: string;
    valid_contacts: number;
    total_contacts: number;
    state: string;
    scheduled_at: string;
    created_at: string;
  }> {
    this.ensureConfigured();
    return await this.request(`/batches/${batchId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_at: scheduledAt }),
    });
  }

  /**
   * Stop a running batch
   * API Reference: POST /batches/{batch_id}/stop
   * 
   * @param batchId - The batch ID to stop
   * @returns Stop confirmation
   */
  async stopBatch(batchId: string): Promise<{ message: string; state: string }> {
    this.ensureConfigured();
    return await this.request(`/batches/${batchId}/stop`, {
      method: 'POST',
    });
  }

  /**
   * Get batch details and execution status
   * API Reference: GET /batches/{batch_id}
   * 
   * @param batchId - The batch ID to get details for
   * @returns Batch details with execution_status breakdown
   */
  async getBatch(batchId: string): Promise<{
    batch_id: string;
    file_name: string;
    valid_contacts: number;
    total_contacts: number;
    state: string;
    scheduled_at?: string;
    created_at: string;
    execution_status?: {
      completed?: number;
      queued?: number;
      ringing?: number;
      in_progress?: number;
      initiated?: number;
      failed?: number;
      [key: string]: number | undefined;
    };
    from_phone_number?: string;
    agent_id: string;
  }> {
    this.ensureConfigured();
    return await this.request(`/batches/${batchId}`);
  }

  /**
   * List all batches for the account
   * 
   * @returns Array of batches
   */
  async listBatches(): Promise<Array<{
    batch_id: string;
    file_name: string;
    valid_contacts: number;
    total_contacts: number;
    state: string;
    scheduled_at?: string;
    created_at: string;
    agent_id: string;
    from_phone_number?: string;
    execution_status?: Record<string, number>;
  }>> {
    this.ensureConfigured();
    try {
      const response = await this.request<any>('/batches');
      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object' && 'batches' in response) {
        return response.batches || [];
      }
      return [];
    } catch (error) {
      console.error('[Bolna] Error listing batches:', error);
      return [];
    }
  }

  /**
   * Run a batch immediately (for batches in 'created' state)
   * This schedules the batch to run now
   * 
   * @param batchId - The batch ID to run
   * @returns Scheduled batch response
   */
  async runBatchNow(batchId: string): Promise<any> {
    this.ensureConfigured();
    // Schedule for immediate execution
    const now = new Date().toISOString();
    return await this.scheduleBatch(batchId, now);
  }

  /**
   * Get call logs for a batch
   * 
   * @param batchId - The batch ID to get call logs for
   * @returns Array of call logs
   */
  async getBatchCallLogs(batchId: string): Promise<any[]> {
    this.ensureConfigured();
    try {
      const response = await this.request<any>(`/batches/${batchId}/calls`);
      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object' && 'calls' in response) {
        return response.calls || [];
      }
      return [];
    } catch (error) {
      console.error(`[Bolna] Error fetching batch call logs for ${batchId}:`, error);
      return [];
    }
  }

  // ==================== BATCH API METHODS ====================

  /**
   * Create a batch for calling via agent
   * API: POST /batches
   * Content-Type: text/csv (multipart/form-data)
   */
  async createBatch(data: {
    agent_id: string;
    csvContent: string;
    from_phone_number?: string;
    retry_config?: {
      enabled: boolean;
      max_retries: number;
      retry_intervals_minutes: number[];
    };
  }): Promise<{ batch_id: string; state: 'created' }> {
    this.ensureConfigured();
    
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('agent_id', data.agent_id);
    
    // Create a Blob from CSV content
    const csvBlob = new Blob([data.csvContent], { type: 'text/csv' });
    formData.append('file', csvBlob, 'leads.csv');
    
    if (data.from_phone_number) {
      formData.append('from_phone_number', data.from_phone_number);
    }
    
    if (data.retry_config) {
      formData.append('retry_config', JSON.stringify(data.retry_config));
    }
    
    const response = await fetch(`${BOLNA_API_URL}/batches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOLNA_API_KEY}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bolna batch creation failed: ${errorText}`);
    }
    
    return await response.json();
  }

  /**
   * Get batch details
   * API: GET /batches/{batch_id}
   */
  async getBatch(batchId: string): Promise<{
    batch_id: string;
    humanized_created_at: string;
    created_at: string;
    updated_at: string;
    status: 'scheduled' | 'created' | 'queued' | 'executed';
    scheduled_at?: string;
    from_phone_number?: string;
    file_name?: string;
    valid_contacts: number;
    total_contacts: number;
    execution_status?: Record<string, number>;
  }> {
    this.ensureConfigured();
    return await this.request(`/batches/${batchId}`);
  }

  /**
   * Schedule a batch for calling
   * API: POST /batches/{batch_id}/schedule
   */
  async scheduleBatch(batchId: string, scheduledAt: string, bypassCallGuardrails: boolean = false): Promise<{ message: string; state: 'scheduled' }> {
    this.ensureConfigured();
    
    const formData = new FormData();
    formData.append('scheduled_at', scheduledAt);
    formData.append('bypass_call_guardrails', String(bypassCallGuardrails));
    
    const response = await fetch(`${BOLNA_API_URL}/batches/${batchId}/schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOLNA_API_KEY}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bolna batch scheduling failed: ${errorText}`);
    }
    
    return await response.json();
  }

  /**
   * Stop a running batch
   * API: POST /batches/{batch_id}/stop
   */
  async stopBatch(batchId: string): Promise<{ message: string; state: 'stopped' }> {
    this.ensureConfigured();
    return await this.request(`/batches/${batchId}/stop`, {
      method: 'POST',
    });
  }

  /**
   * Delete a batch
   * API: DELETE /batches/{batch_id}
   */
  async deleteBatch(batchId: string): Promise<{ message: string; state: 'deleted' }> {
    this.ensureConfigured();
    return await this.request(`/batches/${batchId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all batches for the organization
   * Note: This is a helper that may not exist in Bolna API directly
   * We'll track batches in our database instead
   */
  async listBatches(): Promise<any[]> {
    this.ensureConfigured();
    try {
      // Try to fetch batches - this endpoint may not exist
      return await this.request('/batches');
    } catch (error) {
      // If endpoint doesn't exist, return empty array
      console.log('[Bolna] List batches endpoint not available');
      return [];
    }
  }
}

export const bolnaClient = new BolnaClient();
