
import { GoogleGenAI, Type } from "@google/genai";
import { SEOAudit, OutreachLead, AiProvider } from "./types";

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
      qualificationScore: { 
        type: Type.INTEGER,
        description: "A score from 0-100 indicating how high-priority this lead is for SEO outreach."
      }
    },
    required: ["websiteUrl", "businessName", "email", "phone", "contactPageUrl", "onPageIssues", "technicalIssues", "localSeoIssues", "qualificationScore"]
  }
};

const VALIDATION_SCHEMA = {
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
};

// Fix: Implement and export verifyApiKey to resolve error in ApiKeyGate.tsx
/**
 * Verifies if an API key is valid for the specified provider.
 * This is used by the ApiKeyGate component.
 */
export async function verifyApiKey(provider: AiProvider, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (provider === 'GEMINI') {
    try {
      // Create a local instance just for verification using the provided key.
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'ping',
      });
      return { valid: response.text !== undefined };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Invalid Gemini API Key' };
    }
  } else {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (response.ok) return { valid: true };
      const data = await response.json();
      return { valid: false, error: data.error?.message || 'Invalid OpenAI Key' };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}

export async function performSEOLeadGen(provider: AiProvider, apiKey: string, niche: string, location: string): Promise<{ leads: SEOAudit[], groundingSources: any[] }> {
  // Fix: Adhere to guidelines by using process.env.API_KEY for Gemini calls
  const effectiveApiKey = provider === 'GEMINI' ? process.env.API_KEY : apiKey;
  const ai = new GoogleGenAI({ apiKey: effectiveApiKey || '' });

  const prompt = `
    ACT AS AN ADVANCED SEO LEAD GENERATION AGENT.
    Target: ${niche} in ${location}.
    Find businesses likely on Page 2 of Google. Return exactly 15 high-quality leads in JSON format.
    Calculate qualificationScore (0-100): +15 tech issues, +5 on-page, +30 poor Local SEO.
  `;

  if (provider === 'GEMINI') {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: AUDIT_SCHEMA,
      },
    });
    
    let leads: SEOAudit[] = [];
    try {
      // Fix: Access response.text property directly without calling it
      const text = response.text;
      leads = JSON.parse(text || "[]");
    } catch (e) {
      console.error("Failed to parse leads JSON", e);
    }

    return { 
      leads: leads, 
      // Fix: Extract grounding metadata chunks for display as required by guidelines
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
    };
  } else {
    // OpenAI Fallback
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    const leadsRaw = JSON.parse(data.choices[0].message.content);
    return { leads: leadsRaw.leads || leadsRaw, groundingSources: [] };
  }
}

export async function validateEmailsAgent(provider: AiProvider, apiKey: string, leads: OutreachLead[]): Promise<OutreachLead[]> {
  const effectiveApiKey = provider === 'GEMINI' ? process.env.API_KEY : apiKey;
  const ai = new GoogleGenAI({ apiKey: effectiveApiKey || '' });
  
  const emailList = leads.map(l => l.email).join(', ');
  const prompt = `Validate these emails: ${emailList}. Return JSON with validationStatus (VALID, RISKY, INVALID).`;

  if (provider === 'GEMINI') {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: VALIDATION_SCHEMA,
      },
    });
    
    let results: any[] = [];
    try {
      // Fix: Access response.text property directly
      const text = response.text;
      results = JSON.parse(text || "[]");
    } catch (e) {
      console.error("Failed to parse validation JSON", e);
    }

    return leads.map(lead => ({
      ...lead,
      validationStatus: results.find((r: any) => r.email === lead.email)?.validationStatus || 'VALID'
    }));
  }
  return leads;
}

export async function processOutreachWithAgent(
  provider: AiProvider,
  apiKey: string,
  lead: OutreachLead, 
  senderEmail: string, 
  baseSubject: string, 
  baseBody: string,
  mode: 'AI_CUSTOM' | 'MANUAL'
): Promise<any> {
  const effectiveApiKey = provider === 'GEMINI' ? process.env.API_KEY : apiKey;
  const ai = new GoogleGenAI({ apiKey: effectiveApiKey || '' });
  
  const prompt = mode === 'AI_CUSTOM' 
    ? `Write a UNIQUE SEO outreach email for ${lead.businessName} regarding ${lead.website}. Issues: ${lead.seoErrors}. Return JSON with 'subject' and 'body'.`
    : `Replace placeholders in this template: ${baseBody} for ${lead.businessName}.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
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
  
  let parsed: any = {};
  try {
    // Fix: Access response.text property directly
    const text = response.text;
    parsed = JSON.parse(text || "{}");
  } catch (e) {
    console.error("Failed to parse outreach JSON", e);
  }

  return { name: 'send_smtp_email', args: { to: lead.email, subject: parsed.subject || baseSubject, body: parsed.body || baseBody } };
}
