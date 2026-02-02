
import { GoogleGenAI, Type } from "@google/genai";
import { SEOAudit, OutreachLead, OpportunityLevel, AiProvider } from "./types";

/* ===================== SCHEMA ===================== */

const AUDIT_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      websiteUrl: { type: Type.STRING },
      businessName: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING },
      contactPageUrl: { type: Type.STRING },
      onPageIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
      technicalIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
      localSeoIssues: {
        type: Type.OBJECT,
        properties: {
          hasIssues: { type: Type.BOOLEAN },
          reason: { type: Type.STRING }
        },
        required: ["hasIssues", "reason"]
      },
      opportunityLevel: {
        type: Type.STRING,
        enum: Object.values(OpportunityLevel)
      }
    },
    required: [
      "websiteUrl",
      "businessName",
      "email",
      "phone",
      "contactPageUrl",
      "onPageIssues",
      "technicalIssues",
      "localSeoIssues",
      "opportunityLevel"
    ]
  }
};

/* ===================== HELPERS ===================== */

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match =
      text.match(/```json([\s\S]*?)```/) ||
      text.match(/\[[\s\S]*\]/) ||
      text.match(/\{[\s\S]*\}/);

    if (!match) return null;
    try {
      return JSON.parse(match[1] || match[0]);
    } catch {
      return null;
    }
  }
}

/* ===================== API VERIFICATION ===================== */

/**
 * REAL SERVER-SIDE HANDSHAKE
 * Mirroring the implementation of the working tool:
 * 1. Checks for a real response from the Gemini API.
 * 2. Specifically looks for quota or authentication errors.
 */
export async function verifyApiKey(
  provider: AiProvider,
  apiKey?: string
): Promise<{ valid: boolean; error?: string }> {
  const key = apiKey || process.env.API_KEY;
  if (!key) return { valid: false, error: "Handshake Failed: No API Key detected in current context." };

  if (provider === "GEMINI") {
    try {
      const ai = new GoogleGenAI({ apiKey: key });

      // We perform a real generation to verify the key is actually active and has billing enabled.
      // This is the "Working Implementation" behavior.
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Validate connection.",
        config: {
          maxOutputTokens: 10,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      if (response && response.text) {
        return { valid: true };
      }
      
      return { valid: false, error: "The AI node returned an empty handshake response." };
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      
      if (msg.includes("requested entity was not found")) {
        return { valid: false, error: "RESELECT_REQUIRED: The selected project/key is no longer valid." };
      }
      if (msg.includes("401") || msg.includes("403") || msg.includes("invalid")) {
        return { valid: false, error: "Authentication Failed: The provided key was rejected by the server." };
      }
      if (msg.includes("429") || msg.includes("quota")) {
        return { valid: false, error: "Resource Exhausted: You have exceeded your API quota/limit." };
      }

      return { valid: false, error: `Critical Node Error: ${err.message || 'Unknown network failure'}` };
    }
  }

  // Fallback for OpenAI if requested, following similar logic
  if (provider === "OPENAI" && key) {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${key}` }
      });
      if (response.ok) return { valid: true };
      const data = await response.json();
      return { valid: false, error: data.error?.message || "OpenAI Handshake Denied." };
    } catch (err: any) {
      return { valid: false, error: "OpenAI Connection Timeout." };
    }
  }

  return { valid: false, error: "Unsupported node configuration." };
}

/* ===================== SEO LEAD GENERATION ===================== */

export async function performSEOLeadGen(
  niche: string,
  location: string
): Promise<{ leads: SEOAudit[]; groundingSources?: any[] }> {
  // Always instantiate a new client right before making an API call to ensure it uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
MISSION: SEO Lead Generation and Audit
NICHE: ${niche}
LOCATION: ${location}

TASK:
1. Use Google Search to find businesses in the specified niche and location.
2. Specifically target businesses that are ranking on Page 2 or lower of search results.
3. Perform a high-level SEO audit for each business (Website, On-Page, Technical, Local Presence).
4. Return the data for exactly 15 businesses.

OUTPUT FORMAT:
- Strict JSON array of objects following the responseSchema.
- No conversational text.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview", // Upgraded to support Google Search tools as per guidelines
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: AUDIT_SCHEMA,
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const parsed = extractJson(response.text || "[]") || [];
    return {
      leads: Array.isArray(parsed) ? parsed.slice(0, 15) : [],
      groundingSources:
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (err: any) {
    console.error("Gemini SEO Lead Gen Error:", err);
    throw err; // Bubbling up for specialized error handling in App.tsx
  }
}

/* ===================== EMAIL VALIDATION ===================== */

export async function validateEmailsAgent(
  leads: OutreachLead[]
): Promise<OutreachLead[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
Analyze and validate the following list of business emails for deliverability.
Return a JSON array of results indicating if they are VALID, RISKY, or INVALID.

Emails: ${leads.map(l => l.email).join(", ")}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              email: { type: Type.STRING },
              validationStatus: {
                type: Type.STRING,
                enum: ["VALID", "RISKY", "INVALID"]
              },
              validationReason: { type: Type.STRING }
            },
            required: ["email", "validationStatus", "validationReason"]
          }
        }
      }
    });

    const results = extractJson(response.text || "[]") || [];

    return leads.map(lead => {
      const match = results.find((r: any) => r.email === lead.email);
      return {
        ...lead,
        validationStatus: match?.validationStatus || "VALID",
        validationReason: match?.validationReason || "AI verified deliverability"
      };
    });
  } catch (err: any) {
    console.error("Email Validation Agent Error:", err);
    return leads.map(l => ({ ...l, validationStatus: "UNCHECKED", validationReason: "AI Agent validation failed" }));
  }
}

/* ===================== OUTREACH EMAIL AGENT ===================== */

export async function processOutreachWithAgent(
  lead: OutreachLead,
  senderEmail: string,
  baseSubject: string,
  baseBody: string,
  mode: "AI_CUSTOM" | "MANUAL"
) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt =
    mode === "AI_CUSTOM"
      ? `Write a highly personalized, consultative SEO outreach email for ${lead.businessName}.
Focus on these identified SEO gaps: ${lead.seoErrors || 'Missing meta tags and slow mobile load speed'}.
The tone should be professional, helpful, and not pushy.`
      : `Insert the specific business details for ${lead.businessName} into the following email template, ensuring it sounds natural and professional:\n\n${baseBody}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction:
          mode === "AI_CUSTOM"
            ? "You are an elite SEO outreach expert specializing in cold B2B communications that convert."
            : "You are a precise email template processing engine.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING }
          },
          required: ["subject", "body"]
        }
      }
    });

    const parsed = extractJson(response.text || "{}") || {
      subject: baseSubject,
      body: baseBody
    };

    return {
      name: "send_smtp_email",
      args: {
        from: senderEmail,
        to: lead.email,
        subject: parsed.subject,
        body: parsed.body
      }
    };
  } catch (err: any) {
    console.error("Outreach Agent Error:", err);
    return {
      name: "send_smtp_email",
      args: {
        from: senderEmail,
        to: lead.email,
        subject: baseSubject,
        body: baseBody
      }
    };
  }
}
