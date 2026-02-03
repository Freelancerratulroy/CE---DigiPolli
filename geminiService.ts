
import { GoogleGenAI, Type } from "@google/genai";
import { SEOAudit, OutreachLead, OpportunityLevel, AiProvider, ApiConfig } from "./types";

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

/* ===================== API VERIFICATION GATE ===================== */

/**
 * PRODUCTION-GRADE GENERIC API HANDSHAKE
 * Used for custom API nodes. Performs a real HTTP GET/POST to verify connectivity.
 */
export async function verifyGenericApi(config: ApiConfig): Promise<{ valid: boolean; status?: number; error?: string }> {
  const { apiKey, baseUrl, authType, testEndpoint } = config;
  const ERROR_MSG = "INVALID API KEY – CONNECTION FAILED";

  if (!baseUrl || !testEndpoint || !apiKey) {
    return { valid: false, error: ERROR_MSG };
  }

  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = testEndpoint.startsWith('/') ? testEndpoint : `/${testEndpoint}`;
  const url = `${cleanBase}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (authType === 'Bearer' || authType === 'OAuth') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (authType === 'API-Key') {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const bodyText = await response.text();
    if (response.ok && bodyText.length > 0) {
      return { valid: true, status: response.status };
    }

    return { valid: false, status: response.status, error: ERROR_MSG };
  } catch (err: any) {
    return { valid: false, error: ERROR_MSG };
  }
}

/**
 * REAL-TIME GEMINI HANDSHAKE (NO FAKING)
 * This function triggers a real API call to Google's Gemini servers.
 * If the key is fake or wrong, Google returns an error, and we block access.
 */
export async function verifyApiKey(
  provider: AiProvider,
  apiKey?: string
): Promise<{ valid: boolean; error?: string }> {
  // If a manual key is provided, we MUST use it. Otherwise, we use the injected one.
  const keyToVerify = apiKey || process.env.API_KEY;
  const ERROR_MSG = "INVALID API KEY – CONNECTION FAILED";

  if (!keyToVerify || keyToVerify.trim().length < 10) {
    return { valid: false, error: ERROR_MSG };
  }

  try {
    // Initialize a REAL SDK instance with the key provided
    const ai = new GoogleGenAI({ apiKey: keyToVerify });
    
    /**
     * CRITICAL: We perform a real "Ping" to the Gemini model.
     * If the key is '123' or 'fake-key', this call will throw an exception
     * from the Google backend.
     */
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Handshake: respond with 'OK'.",
      config: {
        maxOutputTokens: 5,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Verification check: Did we get a valid text response?
    if (response && response.text && response.text.includes('OK')) {
      return { valid: true };
    }
    
    // If the response structure is unexpected
    return { valid: false, error: ERROR_MSG };
  } catch (err: any) {
    /**
     * If the key is wrong, the SDK throws an error like:
     * [GoogleGenAI Error]: API_KEY_INVALID
     */
    console.error("[CRITICAL_HANDSHAKE_FAIL]", err.message);
    return { valid: false, error: ERROR_MSG };
  }
}

/* ===================== SEO LEAD GENERATION ===================== */

export async function performSEOLeadGen(
  niche: string,
  location: string
): Promise<{ leads: SEOAudit[]; groundingSources?: any[] }> {
  // Use the verified key for the actual mission
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
MISSION: SEO Lead Generation and Audit
NICHE: ${niche}
LOCATION: ${location}

TASK:
1. Search for businesses in the specified niche and location.
2. Return exactly 15 business results.
3. Format output as JSON:
[
  {
    "websiteUrl": "string",
    "businessName": "string",
    "email": "string",
    "phone": "string",
    "contactPageUrl": "string",
    "onPageIssues": ["string"],
    "technicalIssues": ["string"],
    "localSeoIssues": { "hasIssues": boolean, "reason": "string" },
    "opportunityLevel": "High"
  }
]
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 8192 }
      }
    });

    const rawText = response.text || "";
    const parsed = extractJson(rawText) || [];
    
    return {
      leads: Array.isArray(parsed) ? parsed : [],
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (err: any) {
    console.error("SEO Gen Error:", err);
    throw err;
  }
}

export async function validateEmailsAgent(leads: OutreachLead[]): Promise<OutreachLead[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Validate deliverability: ${leads.map(l => l.email).join(", ")}`;
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
              validationStatus: { type: Type.STRING, enum: ["VALID", "RISKY", "INVALID"] },
              validationReason: { type: Type.STRING }
            },
            required: ["email", "validationStatus", "validationReason"]
          }
        }
      }
    });
    return extractJson(response.text || "[]");
  } catch (err: any) {
    return leads.map(l => ({ ...l, validationStatus: "UNCHECKED" }));
  }
}

export async function processOutreachWithAgent(lead: OutreachLead, senderEmail: string, baseSubject: string, baseBody: string, mode: "AI_CUSTOM" | "MANUAL") {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = mode === "AI_CUSTOM" ? `Write personalized SEO email for ${lead.businessName}` : `Use template for ${lead.businessName}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } },
          required: ["subject", "body"]
        }
      }
    });
    return { name: "send_email", args: extractJson(response.text || "{}") };
  } catch (err: any) {
    return { name: "send_email", args: { subject: baseSubject, body: baseBody } };
  }
}
