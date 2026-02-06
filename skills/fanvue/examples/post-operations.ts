/**
 * Fanvue Post Operations
 * 
 * Examples for creating and managing content posts.
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
// POST OPERATIONS
// ============================================

/**
 * List all posts by the authenticated creator
 */
export async function listPosts(accessToken: string, options?: {
    limit?: number;
    cursor?: string;
}) {
    const url = new URL(`${API_BASE}/posts`);
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);

    const response = await fetch(url, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Get a single post by UUID
 */
export async function getPost(accessToken: string, postUuid: string) {
    const response = await fetch(`${API_BASE}/posts/${postUuid}`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Create a new post
 */
export async function createPost(accessToken: string, options: {
    content: string;
    mediaIds?: string[];
    isPinned?: boolean;
    isSubscribersOnly?: boolean;
    price?: number | null;
}) {
    const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify({
            content: options.content,
            mediaIds: options.mediaIds || [],
            isPinned: options.isPinned || false,
            isSubscribersOnly: options.isSubscribersOnly ?? true,
            price: options.price ?? null,
        }),
    });

    return response.json();
}

/**
 * Get tips received on a post
 */
export async function getPostTips(accessToken: string, postUuid: string) {
    const response = await fetch(`${API_BASE}/posts/${postUuid}/tips`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Get users who liked a post
 */
export async function getPostLikes(accessToken: string, postUuid: string) {
    const response = await fetch(`${API_BASE}/posts/${postUuid}/likes`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Get comments on a post
 */
export async function getPostComments(accessToken: string, postUuid: string) {
    const response = await fetch(`${API_BASE}/posts/${postUuid}/comments`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

// ============================================
// SUBSCRIBER/FOLLOWER OPERATIONS
// ============================================

/**
 * List all followers (free follows)
 */
export async function listFollowers(accessToken: string) {
    const response = await fetch(`${API_BASE}/creators/list-followers`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * List all active subscribers (paid)
 */
export async function listSubscribers(accessToken: string) {
    const response = await fetch(`${API_BASE}/creators/list-subscribers`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Create a free post visible to everyone
const freePost = await createPost(accessToken, {
  content: 'Hey everyone! Check out my profile for exclusive content 💕',
  isSubscribersOnly: false,
});
console.log(`Created post: ${freePost.uuid}`);

// Create a subscribers-only post
const exclusivePost = await createPost(accessToken, {
  content: 'Exclusive content for my amazing subscribers! 🔥',
  mediaIds: ['media-uuid-1', 'media-uuid-2'],
  isSubscribersOnly: true,
});

// Create a PPV (pay-per-view) post
const ppvPost = await createPost(accessToken, {
  content: 'Special content available for purchase! 🎁',
  mediaIds: ['premium-media-uuid'],
  isSubscribersOnly: false,
  price: 9.99,
});

// Get engagement stats for a post
const likes = await getPostLikes(accessToken, ppvPost.uuid);
const tips = await getPostTips(accessToken, ppvPost.uuid);
console.log(`Post has ${likes.data.length} likes and tips totaling $${tips.total}`);

// Get subscriber count
const subscribers = await listSubscribers(accessToken);
const followers = await listFollowers(accessToken);
console.log(`Stats: ${subscribers.data.length} subscribers, ${followers.data.length} followers`);
*/
