export type Role = "USER" | "TRANSLATOR" | "ADMIN";
export type CallType = "AUDIO" | "VIDEO";
export type CallStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "ACTIVE"
  | "ENDED"
  | "MISSED"
  | "REJECTED"
  | "FAILED";
export type VerificationStatus = "REGISTERED" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED";

export interface User {
  id: number;
  phone: string;
  email: string | null;
  fullName: string;
  role: Role;
  status: "ACTIVE" | "BLOCKED";
  avatarFileId: number | null;
  createdAt: string;
}

export interface Language {
  id: number;
  code: string;
  name: string;
}

export interface Theme {
  id: number;
  name: string;
  nameKo: string | null;
  description: string | null;
  iconFileId: number | null;
  isEmergency: boolean;
}

export interface Category {
  id: number;
  name: string;
  iconFileId: number | null;
  themes: Theme[];
}

export interface CategoriesResponse {
  categories: Category[];
  uncategorizedThemes: Theme[];
}

export interface TranslatorCard {
  id: number;
  fullName: string;
  avatarFileId: number | null;
  topikLevel: number | null;
  pricePerMinute: number;
  isOnline: boolean;
  ratingAvg: number;
  reviewsCount: number;
  languages: Language[];
  themes: { id: number; name: string; nameKo: string | null; withCertificate: boolean }[];
}

export interface OwnTranslatorProfile extends TranslatorCard {
  verificationStatus: VerificationStatus;
  dateOfBirth: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Person {
  id: number;
  fullName: string;
  avatarFileId: number | null;
}

export interface CallDto {
  id: number;
  type: CallType;
  status: CallStatus;
  pricePerMinute: number;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  totalCost: number | null;
  client: Person;
  translator: Person;
  language: Language;
  theme: { id: number; name: string; nameKo: string | null };
  review: { rating: number; comment: string | null } | null;
}

export interface ConversationDto {
  id: number;
  createdAt: string;
  lastMessageAt: string | null;
  other: Person & { role: Role };
  lastMessage: { id: number; text: string; senderId: number; createdAt: string } | null;
  unreadCount: number;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  senderId: number;
  callId: number | null;
  text: string;
  readAt: string | null;
  createdAt: string;
}

export interface TransactionDto {
  id: number;
  type: "TOPUP" | "ADMIN_CHARGE" | "CALL_CHARGE" | "CALL_EARNING" | "COMMISSION" | "PAYOUT" | "REFUND";
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  callId: number | null;
  createdAt: string;
}

export interface WalletResponse {
  balance: number;
  currency: string;
  transactions: Paginated<TransactionDto>;
}

export interface PayoutDto {
  id: number;
  amount: number;
  bankName: string;
  accountNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  createdAt: string;
  processedAt: string | null;
}

export interface NotificationDto {
  id: number;
  type: string;
  payload: { event?: string; status?: string } | null;
  isRead: boolean;
  createdAt: string;
}
