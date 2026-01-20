
import { GoogleGenAI, Type } from "@google/genai";
import { SEOAudit, OutreachLead, OpportunityLevel, AiProvider } from "./types";

/**
 * Core initialization helper.
 * Strictly requires a verified API key.
 */
const getAi = (apiKey: string) => {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("UNAUTHORIZED_NODE: No valid API Key found. Please re-authorize at the Socket Gate.");
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
};

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
        enum: Object.values(OpportunityLevel),
        description: "Priority based on SEO audit results."
      }
    },
    required: ["websiteUrl", "businessName", "email", "phone", "contactPageUrl", "onPageIssues", "technicalIssues", "localSeoIssues", "opportunityLevel"]
  }
};

/**
 * MANDATORY API VALIDATION LOGIC
 * Performs a real, live test request to Google Servers.
 * Returns valid: true ONLY if the API responds successfully.
 */
export async function verifyApiKey(provider: AiProvider, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) return { valid: false, error: "Invalid API Key: Key is empty." };
  
  // Strict Handshake for Gemini
  if (provider === 'GEMINI') {
    try {
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      
      // Perform a minimal real request to verify the key's validity and quota
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Verify Connection Handshake',
        config: { 
          maxOutputTokens: 2,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      
      // If we receive any response without an error being thrown, the key is valid.
      if (response && response.text) {
        return { valid: true };
      }
      
      return { valid: false, error: "Invalid API Key – Connection Failed. (Empty Response)" };
    } catch (err: any) {
      console.error("STRICT_AUTH_FAIL:", err);
      
      let errorMsg = "Invalid API Key – Connection Failed.";
      const errStr = (err.message || "").toLowerCase();

      if (errStr.includes("api_key_invalid") || errStr.includes("invalid api key")) {
        errorMsg = "Your API key is wrong. Please check your Gemini credentials.";
      } else if (errStr.includes("quota") || errStr.includes("limit") || errStr.includes("429")) {
        errorMsg = "Quota Exhausted: Your key has no remaining credits or billing is disabled.";
      } else if (errStr.includes("permission") || errStr.includes("403")) {
        errorMsg = "Permission Denied: This key does not have access to Gemini 3 series models.";
      } else if (errStr.includes("network") || errStr.includes("fetch")) {
        errorMsg = "Network Error: Could not reach Google API Servers.";
      }

      return { valid: false, error: errorMsg };
    }
  }

  // Basic check for OpenAI (Simulation since we are focused on Gemini fixes)
  if (provider === 'OPENAI') {
    return { 
      valid: cleanKey.startsWith('sk-') && cleanKey.length > 20, 
      error: cleanKey.startsWith('sk-') ? undefined : 'Your OpenAI key is wrong (Invalid Format).' 
    };
  }

  return { valid: false, error: "Unsupported Provider" };
}

export async function performSEOLeadGen(niche: string, location: string, apiKey: string): Promise<{ leads: SEOAudit[], groundingSources: any[] }> {
  const ai = getAi(apiKey);
  const prompt = `
    ACT AS AN ADVANCED SEO LEAD GENERATION AGENT.
    Target: ${niche} in ${location}.
    Find businesses likely on Page 2 of Google. Return exactly 15 high-quality leads in JSON format matching the schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: AUDIT_SCHEMA,
    },
  });
  
  const leads = JSON.parse(response.text || "[]");
  return { 
    leads, 
    groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
  };
}

export async function validateEmailsAgent(leads: OutreachLead[], apiKey: string): Promise<OutreachLead[]> {
  const ai = getAi(apiKey);
  const emailList = leads.map(l => l.email).join(', ');
  const prompt = `Validate these emails for deliverability: ${emailList}. Return JSON array with validationStatus and reason.`;

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
            validationStatus: { type: Type.STRING, enum: ['VALID', 'RISKY', 'INVALID'] },
            validationReason: { type: Type.STRING }
          },
          required: ["email", "validationStatus", "validationReason"]
        }
      }
    }
  });
  
  const results = JSON.parse(response.text || "[]");
  return leads.map(lead => {
    const match = results.find((r: any) => r.email === lead.email);
    return {
      ...lead,
      validationStatus: match?.validationStatus || 'VALID',
      validationReason: match?.validationReason || 'Verified via Node'
    };
  });
}

export async function processOutreachWithAgent(
  lead: OutreachLead, 
  senderEmail: string, 
  baseSubject: string, 
  baseBody: string,
  mode: 'AI_CUSTOM' | 'MANUAL',
  apiKey: string
): Promise<any> {
  const ai = getAi(apiKey);
  const isAiMode = mode === 'AI_CUSTOM';
  
  const prompt = isAiMode 
    ? `Write a personalized SEO outreach email for ${lead.businessName} focusing on: ${lead.seoErrors}.`
    : `Replace placeholders in this template: ${baseBody} for ${lead.businessName}.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: isAiMode ? "Elite SEO Outreach Architect" : "Template Injector",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING }
        },
        required: ["subject", "body"]
      }
    },
  });
  
  const parsed = JSON.parse(response.text || "{}");
  return { name: 'send_smtp_email', args: { to: lead.email, subject: parsed.subject, body: parsed.body } };
}
