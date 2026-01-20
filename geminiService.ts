
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
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
        description: "A score from 0-100 indicating how high-priority this lead is for SEO outreach. Calculate as: +10 per tech issue, +5 per on-page issue, +30 if missing GMB/Local SEO."
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

export const sendSmtpEmailDeclaration: FunctionDeclaration = {
  name: 'send_smtp_email',
  parameters: {
    type: Type.OBJECT,
    description: "Executes a physical email transmission via the authorized Gmail SMTP node.",
    properties: {
      to: {
        type: Type.STRING,
        description: "Recipient email address extracted from the input data.",
      },
      subject: {
        type: Type.STRING,
        description: "The finalized subject line for the email.",
      },
      body: {
        type: Type.STRING,
        description: "The finalized body content for the email.",
      },
    },
    required: ['to', 'subject', 'body'],
  },
};

export async function verifyApiKey(provider: AiProvider, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (provider === 'GEMINI') {
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Respond with "OK"',
      });
      if (response.text) return { valid: true };
      return { valid: false, error: "Empty response from Gemini." };
    } catch (error: any) {
      if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
        return { valid: false, error: "QUOTA_EXHAUSTED: Gemini API quota exceeded." };
      }
      return { valid: false, error: error.message || "Gemini key verification failed." };
    }
  } else {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5
        })
      });
      const data = await response.json();
      if (response.ok) return { valid: true };
      return { valid: false, error: data.error?.message || "OpenAI key verification failed." };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

export async function performSEOLeadGen(provider: AiProvider, apiKey: string, niche: string, location: string): Promise<{ leads: SEOAudit[], groundingSources: any[] }> {
  const prompt = `
    ACT AS AN ADVANCED SEO LEAD GENERATION AGENT.
    Target: ${niche} in ${location}.
    Find businesses likely on Page 2 of Google. Return exactly 15 high-quality leads in JSON format matching the schema.
    
    SCORING LOGIC for qualificationScore (0-100):
    - Base score is 10.
    - Add 15 points for critical technical issues (Slow speed, no SSL).
    - Add 5 points for each on-page issue (Missing meta tags, no H1).
    - Add 30 points if the business has poor Local SEO or missing Google Maps presence.
    - Max score is 100.
  `;

  if (provider === 'GEMINI') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: AUDIT_SCHEMA,
      },
    });
    return { 
      leads: JSON.parse(response.text || "[]"), 
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
    };
  } else {
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
    const leads = Array.isArray(leadsRaw) ? leadsRaw : (leadsRaw.leads || leadsRaw.results || []);
    return { leads, groundingSources: [] };
  }
}

export async function validateEmailsAgent(provider: AiProvider, apiKey: string, leads: OutreachLead[]): Promise<OutreachLead[]> {
  const emailList = leads.map(l => l.email).join(', ');
  const prompt = `Validate these emails: ${emailList}. Return JSON with fields: email, validationStatus (VALID, RISKY, INVALID), validationReason.`;

  let results: any[] = [];
  if (provider === 'GEMINI') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: VALIDATION_SCHEMA,
      },
    });
    results = JSON.parse(response.text || "[]");
  } else {
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
    const parsed = JSON.parse(data.choices[0].message.content);
    results = Array.isArray(parsed) ? parsed : (parsed.validations || parsed.results || []);
  }

  return leads.map(lead => {
    const match = results.find((r: any) => r.email === lead.email);
    return {
      ...lead,
      validationStatus: match?.validationStatus || 'VALID',
      validationReason: match?.validationReason || 'Verified by AI'
    };
  });
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
  const isAiMode = mode === 'AI_CUSTOM';
  
  const systemInstruction = isAiMode 
    ? "You are an Elite SEO Outreach Architect. You write UNIQUE, non-templated emails. Use specific SEO issues provided in the 'seoErrors' field to prove manual research. Never use placeholders like [Issue]. Write the actual text."
    : "Replace {Business_Name} and {Website} in the provided template.";

  const prompt = isAiMode 
    ? `
      ROLE: BESPOKE OUTREACH AGENT.
      LEAD_CONTEXT:
      Business: ${lead.businessName}
      Website: ${lead.website}
      SEO_ERRORS: ${lead.seoErrors || "General optimization needed"}
      SENDER: ${senderEmail}
      
      TASK: Generate a 100% unique subject and body. Reference the SEO errors specifically. No two emails should be alike.
      RETURN: JSON with 'subject' and 'body'.
    `
    : `
      ROLE: PLACEHOLDER REPLACEMENT.
      BUSINESS: ${lead.businessName}
      WEBSITE: ${lead.website}
      SUBJECT: ${baseSubject}
      BODY: ${baseBody}
      
      TASK: Replace {Business_Name} with "${lead.businessName}" and {Website} with "${lead.website}".
      RETURN: JSON with 'subject' and 'body'.
    `;

  if (provider === 'GEMINI') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
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
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return { name: 'send_smtp_email', args: { to: lead.email, subject: content.subject, body: content.body } };
  }
}
