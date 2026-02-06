/**
 * Fanvue API TypeScript Type Definitions
 * 
 * Type definitions for API responses.
 */

// ============================================
// USER TYPES
// ============================================

export interface FanvueUser {
    uuid: string;
    username: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    isCreator: boolean;
    createdAt: string;
}

// ============================================
// CHAT TYPES
// ============================================

export interface Chat {
    userUuid: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount: number;
    nickname?: string;
}

export interface ChatMessage {
    id: string;
    content: string;
    senderUuid: string;
    recipientUuid: string;
    createdAt: string;
    mediaUrls: string[];
    isRead: boolean;
}

export interface UnreadCounts {
    unreadChats: number;
    unreadMessages: number;
    unreadNotifications: number;
}

// ============================================
// POST TYPES
// ============================================

export interface Post {
    uuid: string;
    content: string;
    mediaUrls: string[];
    mediaIds: string[];
    isPinned: boolean;
    isSubscribersOnly: boolean;
    price?: number;
    likesCount: number;
    commentsCount: number;
    tipsTotal: number;
    createdAt: string;
    updatedAt: string;
}

export interface PostLike {
    userUuid: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    likedAt: string;
}

export interface PostComment {
    id: string;
    userUuid: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    content: string;
    createdAt: string;
}

export interface PostTip {
    userUuid: string;
    username: string;
    displayName: string;
    amount: number;
    createdAt: string;
}

// ============================================
// SUBSCRIBER/FOLLOWER TYPES
// ============================================

export interface Subscriber {
    userUuid: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    subscribedAt: string;
    renewsAt: string;
    tier?: string;
    totalSpent?: number;
}

export interface Follower {
    userUuid: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    followedAt: string;
}

// ============================================
// INSIGHTS TYPES
// ============================================

export interface Earnings {
    total: number;
    subscriptions: number;
    tips: number;
    ppv: number;
    messages: number;
    period: string;
    startDate: string;
    endDate: string;
}

export interface TopSpender {
    userUuid: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    totalSpent: number;
    subscriptionSpent: number;
    tipsSpent: number;
    ppvSpent: number;
}

export interface SubscriberStats {
    total: number;
    active: number;
    expired: number;
    newThisWeek: number;
    newThisMonth: number;
    churnRate: number;
}

export interface FanInsights {
    totalFans: number;
    activeFans: number;
    averageEngagement: number;
    topCountries: Array<{ country: string; count: number }>;
}

// ============================================
// MEDIA TYPES
// ============================================

export interface MediaItem {
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnailUrl?: string;
    filename: string;
    fileSize: number;
    createdAt: string;
    folderId?: string;
}

export interface VaultFolder {
    id: string;
    name: string;
    parentFolderId?: string;
    itemCount: number;
    createdAt: string;
}

export interface UploadSession {
    uploadSessionId: string;
    uploadUrl: string;
    parts: Array<{
        partNumber: number;
        uploadUrl: string;
    }>;
}

// ============================================
// TRACKING LINK TYPES
// ============================================

export interface TrackingLink {
    uuid: string;
    name: string;
    url: string;
    destination: 'profile' | 'subscription';
    clicks: number;
    conversions: number;
    createdAt: string;
}

// ============================================
// PAGINATION TYPES
// ============================================

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        nextCursor?: string;
        hasMore: boolean;
    };
}

// ============================================
// TOKEN TYPES
// ============================================

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
}
