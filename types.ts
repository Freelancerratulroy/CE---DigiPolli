
export type AccountStatus = 'TRIAL' | 'PAID';
export type CampaignMode = 'MANUAL' | 'AI_CUSTOM';
export type OutreachStatus = 'CONNECTED' | 'DISCONNECTED' | 'FAILED' | 'VERIFIED';
export type ValidationStatus = 'VALID' | 'RISKY' | 'INVALID' | 'UNCHECKED';
export type ApiKeyStatus = 'UNSET' | 'VERIFIED' | 'FAILED' | 'ERROR';
export type AiProvider = 'GEMINI' | 'OPENAI';

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
  qualificationScore: number; // 0-100 based on severity of issues
}

export interface OutreachLead {
  email: string;
  businessName?: string;
  website?: string;
  location?: string;
  seoErrors?: string; // New field for detailed AI personalization
  notes?: string;
  validationStatus?: ValidationStatus;
  validationReason?: string;
  qualificationScore?: number;
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
  type: 'LEAD_GEN' | 'CAMPAIGN' | 'SECURITY_EVENT' | 'VALIDATION';
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
  };
  output: {
    rowCount: number;
    sentCount?: number;
    success?: boolean;
    error?: string;
    validCount?: number;
  };
}

export interface SearchState {
  status: 'idle' | 'searching' | 'completed' | 'error';
  progress: number;
  results: SEOAudit[];
  error?: string;
  groundingSources?: any[];
}
