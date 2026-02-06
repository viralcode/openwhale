/**
 * Fanvue Insights & Analytics
 * 
 * Examples for retrieving earnings, subscriber stats, and fan insights.
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
// EARNINGS & FINANCIAL DATA
// ============================================

/**
 * Get earnings data
 */
export async function getEarnings(accessToken: string, options?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
}) {
    const url = new URL(`${API_BASE}/insights/get-earnings`);
    if (options?.period) url.searchParams.set('period', options.period);
    if (options?.startDate) url.searchParams.set('startDate', options.startDate);
    if (options?.endDate) url.searchParams.set('endDate', options.endDate);

    const response = await fetch(url, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Get top spenders (most active fans)
 */
export async function getTopSpenders(accessToken: string) {
    const response = await fetch(`${API_BASE}/insights/get-top-spenders`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

// ============================================
// SUBSCRIBER ANALYTICS
// ============================================

/**
 * Get subscriber count statistics
 */
export async function getSubscriberStats(accessToken: string) {
    const response = await fetch(`${API_BASE}/insights/get-subscribers`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Get detailed fan insights and engagement metrics
 */
export async function getFanInsights(accessToken: string) {
    const response = await fetch(`${API_BASE}/insights/get-fan-insights`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

// ============================================
// TRACKING LINKS (CAMPAIGN ANALYTICS)
// ============================================

/**
 * List all tracking/campaign links
 */
export async function listTrackingLinks(accessToken: string) {
    const response = await fetch(`${API_BASE}/tracking-links`, {
        headers: getHeaders(accessToken),
    });

    return response.json();
}

/**
 * Create a new tracking link
 */
export async function createTrackingLink(accessToken: string, options: {
    name: string;
    destination?: 'profile' | 'subscription';
}) {
    const response = await fetch(`${API_BASE}/tracking-links`, {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify({
            name: options.name,
            destination: options.destination || 'profile',
        }),
    });

    return response.json();
}

/**
 * Delete a tracking link
 */
export async function deleteTrackingLink(accessToken: string, linkUuid: string) {
    const response = await fetch(`${API_BASE}/tracking-links/${linkUuid}`, {
        method: 'DELETE',
        headers: getHeaders(accessToken),
    });

    return response.ok;
}

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Get this month's earnings
const monthlyEarnings = await getEarnings(accessToken, { period: 'month' });
console.log(`This month: $${monthlyEarnings.total}`);

// Get earnings for a specific date range
const customEarnings = await getEarnings(accessToken, {
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});
console.log(`January earnings: $${customEarnings.total}`);

// Identify your top supporters
const topSpenders = await getTopSpenders(accessToken);
console.log('Top fans:');
topSpenders.data.slice(0, 5).forEach((fan, i) => {
  console.log(`${i + 1}. ${fan.displayName} - $${fan.totalSpent}`);
});

// Get subscriber growth stats
const subStats = await getSubscriberStats(accessToken);
console.log(`Total subscribers: ${subStats.total}`);
console.log(`New this week: ${subStats.newThisWeek}`);
console.log(`Churn rate: ${subStats.churnRate}%`);

// Create campaign tracking links
const instagramLink = await createTrackingLink(accessToken, {
  name: 'Instagram Bio',
  destination: 'profile',
});
console.log(`Track Instagram traffic: ${instagramLink.url}`);

const twitterLink = await createTrackingLink(accessToken, {
  name: 'Twitter Promo',
  destination: 'subscription',
});
console.log(`Track Twitter subs: ${twitterLink.url}`);

// Review campaign performance
const campaigns = await listTrackingLinks(accessToken);
campaigns.data.forEach(link => {
  console.log(`${link.name}: ${link.clicks} clicks, ${link.conversions} conversions`);
});
*/
