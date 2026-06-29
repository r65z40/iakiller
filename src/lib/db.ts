import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

interface Ad {
  id: string;
  name: string;
  type: "banner" | "sidebar" | "interstitial" | "native" | "popup";
  position: "header" | "sidebar" | "content" | "footer" | "popup";
  content: string;
  imageUrl?: string;
  targetUrl?: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

interface Processing {
  id: string;
  type: "image" | "text" | "video";
  sessionId: string;
  fileName?: string;
  fileSize?: number;
  processedAt: string;
  ip?: string;
  userAgent?: string;
}

interface Session {
  id: string;
  firstSeen: string;
  lastSeen: string;
  processings: number;
  ip?: string;
  userAgent?: string;
  country?: string;
  premiumKey?: string;
}

interface PremiumKey {
  id: string;
  key: string;
  label: string;
  dailyLimit: number;
  noAds: boolean;
  active: boolean;
  usedBy: string[];
  createdAt: string;
  expiresAt?: string;
}

interface SiteSettings {
  dailyLimitFree: number;
  popupAdEnabled: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface Database {
  ads: Ad[];
  processings: Processing[];
  sessions: Session[];
  admins: AdminUser[];
  premiumKeys: PremiumKey[];
  settings: SiteSettings;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDbPath(): string {
  return path.join(DATA_DIR, "db.json");
}

function defaultDb(): Database {
  return {
    ads: [],
    processings: [],
    sessions: [],
    admins: [],
    premiumKeys: [],
    settings: {
      dailyLimitFree: 10,
      popupAdEnabled: true,
    },
  };
}

export function readDb(): Database {
  ensureDataDir();
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    const db = defaultDb();
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return db;
  }
  const raw = fs.readFileSync(dbPath, "utf-8");
  return JSON.parse(raw) as Database;
}

export function writeDb(db: Database): void {
  ensureDataDir();
  fs.writeFileSync(getDbPath(), JSON.stringify(db, null, 2));
}

export function getAds(): Ad[] {
  return readDb().ads;
}

export function getActiveAds(position?: string): Ad[] {
  const ads = readDb().ads.filter((a) => a.active);
  if (position) return ads.filter((a) => a.position === position);
  return ads;
}

export function getAd(id: string): Ad | undefined {
  return readDb().ads.find((a) => a.id === id);
}

export function createAd(ad: Ad): Ad {
  const db = readDb();
  db.ads.push(ad);
  writeDb(db);
  return ad;
}

export function updateAd(id: string, updates: Partial<Ad>): Ad | null {
  const db = readDb();
  const idx = db.ads.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  db.ads[idx] = { ...db.ads[idx], ...updates, updatedAt: new Date().toISOString() };
  writeDb(db);
  return db.ads[idx];
}

export function deleteAd(id: string): boolean {
  const db = readDb();
  const idx = db.ads.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  db.ads.splice(idx, 1);
  writeDb(db);
  return true;
}

export function incrementAdImpressions(id: string): void {
  const db = readDb();
  const ad = db.ads.find((a) => a.id === id);
  if (ad) {
    ad.impressions++;
    writeDb(db);
  }
}

export function incrementAdClicks(id: string): void {
  const db = readDb();
  const ad = db.ads.find((a) => a.id === id);
  if (ad) {
    ad.clicks++;
    writeDb(db);
  }
}

export function addProcessing(processing: Processing): void {
  const db = readDb();
  db.processings.push(processing);
  writeDb(db);
}

export function getProcessings(limit = 100, offset = 0): Processing[] {
  const db = readDb();
  return db.processings
    .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
    .slice(offset, offset + limit);
}

export function getProcessingStats() {
  const db = readDb();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const total = db.processings.length;
  const todayCount = db.processings.filter(
    (p) => new Date(p.processedAt) >= today
  ).length;
  const weekCount = db.processings.filter(
    (p) => new Date(p.processedAt) >= weekAgo
  ).length;
  const monthCount = db.processings.filter(
    (p) => new Date(p.processedAt) >= monthAgo
  ).length;

  const byType = {
    image: db.processings.filter((p) => p.type === "image").length,
    text: db.processings.filter((p) => p.type === "text").length,
    video: db.processings.filter((p) => p.type === "video").length,
  };

  const last30Days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    const count = db.processings.filter(
      (p) => p.processedAt.startsWith(dateStr)
    ).length;
    last30Days.push({ date: dateStr, count });
  }

  return { total, todayCount, weekCount, monthCount, byType, last30Days };
}

export function upsertSession(sessionId: string, ip?: string, userAgent?: string): void {
  const db = readDb();
  const existing = db.sessions.find((s) => s.id === sessionId);
  if (existing) {
    existing.lastSeen = new Date().toISOString();
    existing.processings++;
  } else {
    db.sessions.push({
      id: sessionId,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      processings: 1,
      ip,
      userAgent,
    });
  }
  writeDb(db);
}

export function getSessions(limit = 100, offset = 0) {
  const db = readDb();
  return {
    sessions: db.sessions
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .slice(offset, offset + limit),
    total: db.sessions.length,
  };
}

export function getSessionStats() {
  const db = readDb();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    total: db.sessions.length,
    today: db.sessions.filter((s) => new Date(s.lastSeen) >= today).length,
    thisWeek: db.sessions.filter((s) => new Date(s.lastSeen) >= weekAgo).length,
  };
}

export function getAdmin(email: string): AdminUser | undefined {
  return readDb().admins.find((a) => a.email === email);
}

export function createAdmin(admin: AdminUser): void {
  const db = readDb();
  db.admins.push(admin);
  writeDb(db);
}

// Daily limit tracking
export function getDailyProcessingCount(sessionId: string): number {
  const db = readDb();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return db.processings.filter(
    (p) => p.sessionId === sessionId && p.processedAt >= todayStart
  ).length;
}

export function getSettings(): SiteSettings {
  const db = readDb();
  return db.settings || { dailyLimitFree: 10, popupAdEnabled: true };
}

export function updateSettings(updates: Partial<SiteSettings>): SiteSettings {
  const db = readDb();
  db.settings = { ...db.settings, ...updates };
  writeDb(db);
  return db.settings;
}

// Premium keys
export function getPremiumKeys(): PremiumKey[] {
  return readDb().premiumKeys || [];
}

export function createPremiumKey(key: PremiumKey): PremiumKey {
  const db = readDb();
  if (!db.premiumKeys) db.premiumKeys = [];
  db.premiumKeys.push(key);
  writeDb(db);
  return key;
}

export function getPremiumKey(key: string): PremiumKey | undefined {
  const db = readDb();
  return (db.premiumKeys || []).find((k) => k.key === key && k.active);
}

export function deletePremiumKey(id: string): boolean {
  const db = readDb();
  const idx = (db.premiumKeys || []).findIndex((k) => k.id === id);
  if (idx === -1) return false;
  db.premiumKeys.splice(idx, 1);
  writeDb(db);
  return true;
}

export function activatePremiumForSession(sessionId: string, premiumKeyStr: string): boolean {
  const db = readDb();
  const key = (db.premiumKeys || []).find((k) => k.key === premiumKeyStr && k.active);
  if (!key) return false;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return false;
  const session = db.sessions.find((s) => s.id === sessionId);
  if (session) {
    session.premiumKey = premiumKeyStr;
  }
  if (!key.usedBy.includes(sessionId)) {
    key.usedBy.push(sessionId);
  }
  writeDb(db);
  return true;
}

export function getSessionPremiumStatus(sessionId: string): { isPremium: boolean; dailyLimit: number; noAds: boolean } {
  const db = readDb();
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session?.premiumKey) {
    return { isPremium: false, dailyLimit: db.settings?.dailyLimitFree || 10, noAds: false };
  }
  const key = (db.premiumKeys || []).find((k) => k.key === session.premiumKey && k.active);
  if (!key || (key.expiresAt && new Date(key.expiresAt) < new Date())) {
    return { isPremium: false, dailyLimit: db.settings?.dailyLimitFree || 10, noAds: false };
  }
  return { isPremium: true, dailyLimit: key.dailyLimit, noAds: key.noAds };
}

export type { Ad, Processing, Session, AdminUser, Database, PremiumKey, SiteSettings };
