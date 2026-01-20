
import { ActivityLog, User, Campaign, SentEmail } from '../types';

const LOGS_KEY = 'seo_saas_logs_v8';
const USERS_KEY = 'seo_saas_users_v8';
const CAMPAIGNS_KEY = 'seo_saas_campaigns_v8';
const SENT_EMAILS_KEY = 'seo_saas_sent_emails_v8';

export const backendService = {
  // --- AUTH ---
  register: (name: string, email: string): User => {
    const users = backendService.getUsers();
    const existing = users.find(u => u.email === email);
    if (existing) return existing;

    const newUser: User = {
      id: `USR-${Math.random().toString(36).substring(2, 9)}`,
      name,
      email,
      status: 'TRIAL',
      trialQueriesRemaining: 3,
      totalQueriesUsed: 0,
      createdAt: new Date().toISOString(),
      activeAiProvider: 'GEMINI',
      geminiKeyStatus: 'UNSET',
      openaiKeyStatus: 'UNSET'
    };
    
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return newUser;
  },

  login: (email: string): User | null => {
    const users = backendService.getUsers();
    return users.find(u => u.email === email) || null;
  },

  updateUser: (updatedUser: User) => {
    const users = backendService.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  },

  getUsers: (): User[] => {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  // --- LOGGING ---
  logActivity: async (log: ActivityLog): Promise<boolean> => {
    try {
      const logs = backendService.getLogs();
      logs.unshift(log);
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 5000)));
      return true;
    } catch { return false; }
  },

  getLogs: (): ActivityLog[] => {
    try {
      const raw = localStorage.getItem(LOGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  // --- CAMPAIGNS ---
  saveCampaign: (campaign: Campaign) => {
    const campaigns = backendService.getCampaigns();
    const existingIdx = campaigns.findIndex(c => c.id === campaign.id);
    if (existingIdx !== -1) {
      campaigns[existingIdx] = campaign;
    } else {
      campaigns.unshift(campaign);
    }
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
  },

  getCampaigns: (userId?: string): Campaign[] => {
    try {
      const raw = localStorage.getItem(CAMPAIGNS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      if (userId) return all.filter((c: Campaign) => c.userId === userId);
      return all;
    } catch { return []; }
  },

  getCampaignStats: (campaignId: string) => {
    const emails = backendService.getSentEmails(campaignId);
    const sent = emails.filter(e => e.status === 'SENT').length;
    const failed = emails.filter(e => e.status === 'FAILED').length;
    const opened = emails.filter(e => e.opened).length;
    const total = emails.length;
    const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
    
    return {
      total,
      sent,
      failed,
      opened,
      successRate,
      openRate,
      emails
    };
  },

  // --- SENT EMAILS ---
  logSentEmail: (email: SentEmail) => {
    try {
      const emails = backendService.getSentEmails();
      emails.unshift(email);
      localStorage.setItem(SENT_EMAILS_KEY, JSON.stringify(emails.slice(0, 10000)));
    } catch (e) { console.error(e); }
  },

  getSentEmails: (campaignId?: string): SentEmail[] => {
    try {
      const raw = localStorage.getItem(SENT_EMAILS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      if (campaignId) return all.filter((e: SentEmail) => e.campaignId === campaignId);
      return all;
    } catch { return []; }
  },

  simulateEmailOpen: (emailId: string) => {
    const emails = backendService.getSentEmails();
    const idx = emails.findIndex(e => e.id === emailId);
    if (idx !== -1) {
      emails[idx].opened = true;
      emails[idx].openedAt = new Date().toISOString();
      localStorage.setItem(SENT_EMAILS_KEY, JSON.stringify(emails));
    }
  },

  applyPromo: (userId: string, code: string): User | null => {
    const users = backendService.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    if (code === 'chudling pong') {
      user.status = 'PAID';
      user.promoUsed = code;
      backendService.updateUser(user);
      return user;
    }
    return null;
  }
};
