/**
 * Fanvue Chat Operations
 * 
 * Examples for managing chats and messages via the Fanvue API.
 */

const API_BASE = 'https://api.fanvue.com';
const API_VERSION = '2025-06-26';

function getHeaders(accessToken: string): HeadersInit {
    return {
        'Authorization': `Bearer ${accessToken}`,
        'X-Fanvue-API-Version': API_VERSION,
        'Content-Type': 'application/json',
    };
}

// ============================================
// CHAT OPERATIONS
// ============================================

/**
 * List all chat conversations
 */
export async function listChats(accessToken: string, options?: {
    limit?: number;
    cursor?: string;
}) {
    const url = new URL(`${API_BASE}/chats`);
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);

    const response = await fetch(url, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Get unread message counts
 */
export async function getUnreadCounts(accessToken: string) {
    const response = await fetch(`${API_BASE}/chats/unread`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Mark a chat as read
 */
export async function markChatAsRead(accessToken: string, userUuid: string) {
    const response = await fetch(`${API_BASE}/chats/${userUuid}`, {
        method: 'PATCH',
        headers: getHeaders(accessToken),
        body: JSON.stringify({ markAsRead: true }),
    });

    return response.json();
}

/**
 * Set a nickname for a fan
 */
export async function setFanNickname(accessToken: string, userUuid: string, nickname: string) {
    const response = await fetch(`${API_BASE}/chats/${userUuid}`, {
        method: 'PATCH',
        headers: getHeaders(accessToken),
        body: JSON.stringify({ nickname }),
    });

    return response.json();
}

/**
 * Check online status for multiple users
 */
export async function getOnlineStatuses(accessToken: string, userUuids: string[]) {
    const response = await fetch(`${API_BASE}/chats/online-statuses`, {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify({ userUuids }),
    });

    return response.json();
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

/**
 * Get messages from a specific chat
 */
export async function getMessages(accessToken: string, userUuid: string, options?: {
    limit?: number;
    cursor?: string;
}) {
    const url = new URL(`${API_BASE}/chat-messages`);
    url.searchParams.set('userUuid', userUuid);
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);

    const response = await fetch(url, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Send a message to a single user
 */
export async function sendMessage(accessToken: string, options: {
    recipientUuid: string;
    content: string;
    mediaIds?: string[];
}) {
    const response = await fetch(`${API_BASE}/chat-messages`, {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify({
            recipientUuid: options.recipientUuid,
            content: options.content,
            mediaIds: options.mediaIds || [],
        }),
    });

    return response.json();
}

/**
 * Send a mass message to multiple users
 */
export async function sendMassMessage(accessToken: string, options: {
    recipientUuids: string[];
    content: string;
    mediaIds?: string[];
}) {
    const response = await fetch(`${API_BASE}/chat-messages/mass`, {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify({
            recipientUuids: options.recipientUuids,
            content: options.content,
            mediaIds: options.mediaIds || [],
        }),
    });

    return response.json();
}

/**
 * Delete a message
 */
export async function deleteMessage(accessToken: string, messageId: string) {
    const response = await fetch(`${API_BASE}/chat-messages/${messageId}`, {
        method: 'DELETE',
        headers: getHeaders(accessToken),
    });

    return response.ok;
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// List recent chats
const chats = await listChats(accessToken, { limit: 20 });
console.log(`You have ${chats.data.length} conversations`);

// Get unread count
const unread = await getUnreadCounts(accessToken);
console.log(`Unread messages: ${unread.unreadCount}`);

// Send a welcome message to a new subscriber
await sendMessage(accessToken, {
  recipientUuid: 'new-subscriber-uuid',
  content: 'Welcome to my page! Thanks for subscribing 💕',
});

// Send announcement to all subscribers
const subscribers = await listSubscribers(accessToken);
const subscriberUuids = subscribers.data.map(s => s.userUuid);

await sendMassMessage(accessToken, {
  recipientUuids: subscriberUuids,
  content: 'New exclusive content just dropped! Check it out 🔥',
});
*/
