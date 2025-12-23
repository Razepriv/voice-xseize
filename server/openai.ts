// Reference: javascript_openai integration
import OpenAI from "openai";

const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
const openai = hasOpenAIKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function handleMissingKey(feature: string) {
  console.warn(`[OpenAI] OPENAI_API_KEY missing – ${feature} returning fallback text.`);
}

export async function generateAISummary(text: string): Promise<string> {
  if (!openai) {
    handleMissingKey("generateAISummary");
    return "AI summarization is disabled (missing API key).";
  }
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that creates concise, professional summaries of conversations and interactions. Focus on key points, outcomes, and action items.",
        },
        {
          role: "user",
          content: `Please summarize the following conversation:\n\n${text}`,
        },
      ],
      max_completion_tokens: 500,
    });

    return response.choices[0].message.content || "No summary available.";
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return "Summary generation failed.";
  }
}

export async function analyzeLeadQualification(leadData: {
  name: string;
  company?: string;
  notes?: string;
}): Promise<string> {
  if (!openai) {
    handleMissingKey("analyzeLeadQualification");
    return "Lead analysis unavailable (missing OpenAI API key).";
  }
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are a sales assistant AI that helps qualify leads. Provide concise insights about lead potential, recommended actions, and priority level.",
        },
        {
          role: "user",
          content: `Analyze this lead:\nName: ${leadData.name}\nCompany: ${leadData.company || 'Unknown'}\nNotes: ${leadData.notes || 'No notes'}\n\nProvide a brief qualification assessment.`,
        },
      ],
      max_completion_tokens: 300,
    });

    return response.choices[0].message.content || "No analysis available.";
  } catch (error) {
    console.error("Error analyzing lead:", error);
    return "Lead analysis failed.";
  }
}

export async function generateMeetingSummary(transcription: string): Promise<string> {
  if (!openai) {
    handleMissingKey("generateMeetingSummary");
    return "Meeting summary unavailable (missing OpenAI API key).";
  }
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that creates structured meeting summaries. Include: 1) Key discussion points, 2) Decisions made, 3) Action items, 4) Follow-up needed.",
        },
        {
          role: "user",
          content: `Create a meeting summary from this transcription:\n\n${transcription}`,
        },
      ],
      max_completion_tokens: 600,
    });

    return response.choices[0].message.content || "No summary available.";
  } catch (error) {
    console.error("Error generating meeting summary:", error);
    return "Meeting summary generation failed.";
  }
}

export async function matchLeadsToAgents(
  leads: { id: string; name: string; company?: string; notes?: string }[],
  agents: { id: string; name: string; description?: string; systemPrompt?: string }[]
): Promise<Record<string, string>> {
  if (!openai) {
    handleMissingKey("matchLeadsToAgents");
    // Fallback: Round robin if no API key
    const mapping: Record<string, string> = {};
    leads.forEach((lead, index) => {
      mapping[lead.id] = agents[index % agents.length].id;
    });
    return mapping;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an intelligent sales manager AI. Your task is to assign leads to the most suitable AI agents based on the agent's persona/capabilities and the lead's profile.
          
          Return a JSON object where keys are lead IDs and values are agent IDs.
          Example: { "lead_123": "agent_456", "lead_789": "agent_012" }
          
          Ensure every lead is assigned to exactly one agent.`,
        },
        {
          role: "user",
          content: `Leads:
          ${JSON.stringify(leads.map(l => ({ id: l.id, name: l.name, company: l.company, notes: l.notes })))}
          
          Agents:
          ${JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, description: a.description, prompt: a.systemPrompt })))}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return {};
    return JSON.parse(content);
  } catch (error) {
    console.error("Error matching leads to agents:", error);
    // Fallback to round robin on error
    const mapping: Record<string, string> = {};
    leads.forEach((lead, index) => {
      mapping[lead.id] = agents[index % agents.length].id;
    });
    return mapping;
  }
}
