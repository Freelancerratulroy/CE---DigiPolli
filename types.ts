
export enum OpportunityLevel {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export type AccountStatus = 'TRIAL' | 'PAID';
export type CampaignMode = 'MANUAL' | 'AI_CUSTOM';
export type OutreachStatus = 'CONNECTED' | 'DISCONNECTED' | 'FAILED' | 'VERIFIED';
export type ValidationStatus = 'VALID' | 'RISKY' | 'INVALID' | 'UNCHECKED';
export type ApiKeyStatus = 'UNSET' | 'VERIFIED' | 'FAILED' | 'ERROR';
export type AiProvider = 'GEMINI' | 'OPENAI' | 'CUSTOM';

export interface ApiConfig {
  providerName: string;
  apiKey: string;
  baseUrl: string;
  authType: 'Bearer' | 'API-Key' | 'OAuth';
  testEndpoint: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  trialQueriesRemaining: number;
  totalQueriesUsed: number;
  createdAt: string;
  promoUsed?: string;
  
  // AI Configuration
  activeAiProvider: AiProvider;
  geminiApiKey?: string;
  geminiKeyStatus: ApiKeyStatus;
  openaiApiKey?: string;
  openaiKeyStatus: ApiKeyStatus;
  
  // Generic API Config
  apiConfig?: ApiConfig;
  
  apiKeyVerifiedAt?: string;
  emailConnection?: {
    email: string;
    status: OutreachStatus;
    timestamp: string;
    verifiedAt?: string;
    method: 'OAUTH' | 'APP_PASSWORD';
    error?: string;
  };
}

export interface SEOAudit {
  websiteUrl: string;
  businessName: string;
  email: string;
  phone: string;
  contactPageUrl: string;
  onPageIssues: string[];
  technicalIssues: string[];
  localSeoIssues: {
    hasIssues: boolean;
    reason: string;
  };
  opportunityLevel: OpportunityLevel;
}

export interface OutreachLead {
  email: string;
  businessName?: string;
  website?: string;
  location?: string;
  seoErrors?: string;
  notes?: string;
  validationStatus?: ValidationStatus;
  validationReason?: string;
}

export interface DraftEmail {
  id: string;
  recipient: string;
  businessName: string;
  subject: string;
  body: string;
}

export interface SentEmail {
  id: string;
  campaignId: string;
  recipient: string;
  businessName: string;
  website?: string;
  subject: string;
  body: string;
  status: 'SENT' | 'FAILED' | 'SCHEDULED';
  opened: boolean;
  openedAt?: string;
  timestamp: string;
  scheduledTime?: string;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  mode: CampaignMode;
  fileName: string;
  senderEmail: string;
  scheduledTime?: string;
  timezone?: string;
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    opened: number;
  };
  verificationHash: string;
  createdAt: string;
  status: 'QUEUED' | 'SENDING' | 'COMPLETED' | 'SCHEDULED';
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  accountStatus: AccountStatus;
  type: 'LEAD_GEN' | 'CAMPAIGN' | 'SECURITY_EVENT' | 'VALIDATION' | 'API_VERIFICATION';
  input: {
    niche?: string;
    location?: string;
    campaignName?: string;
    mode?: CampaignMode;
    fileName?: string;
    connectionMethod?: string;
    status?: string;
    scheduledTime?: string;
    emailCount?: number;
    provider?: string;
  };
  output: {
    rowCount: number;
    sentCount?: number;
    success?: boolean;
    error?: string;
    validCount?: number;
    httpStatus?: number;
  };
}

export interface SearchState {
  status: 'idle' | 'searching' | 'completed' | 'error';
  progress: number;
  results: SEOAudit[];
  error?: string;
  groundingSources?: any[];
}
