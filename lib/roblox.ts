// lib/roblox.ts

// Helper to create a timeout signal (compatible with all Node versions)
function createTimeoutSignal(timeoutMs: number): AbortSignal {
    if (typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs);
    }
    // Fallback for older Node versions
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
}

export async function fetchRobloxUser(username: string, retries: number = 3): Promise<{ id: number; name: string; displayName: string } | null> {
    const url = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            if (attempt > 0) {
                // Exponential backoff: wait 2s, 4s, 8s between retries for 5xx errors
                // For 429 errors, we use longer delays (5s, 10s, 20s) - handled below
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
                console.log(`Retrying Roblox user fetch for ${username} (attempt ${attempt + 1}/${retries}) after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            console.log(`Fetching Roblox user from: ${url} (attempt ${attempt + 1}/${retries})`);
            const response = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                // Increase timeout to 30 seconds
                signal: createTimeoutSignal(30000)
            });

            if (!response.ok) {
                // Handle 429 (Too Many Requests) errors with exponential backoff and Retry-After header
                if (response.status === 429) {
                    const retryAfterHeader = response.headers.get('Retry-After');
                    let retryAfterSeconds: number | null = null;
                    
                    if (retryAfterHeader) {
                        retryAfterSeconds = parseInt(retryAfterHeader, 10);
                        if (isNaN(retryAfterSeconds)) {
                            retryAfterSeconds = null;
                        }
                    }
                    
                    // Longer exponential backoff for 429 errors: 5s, 10s, 20s
                    const exponentialBackoffDelay = Math.min(5000 * Math.pow(2, attempt), 20000);
                    const delay = retryAfterSeconds 
                        ? Math.max(retryAfterSeconds * 1000, exponentialBackoffDelay)
                        : exponentialBackoffDelay;
                    
                    console.error(`Roblox API rate limit (429) for ${username} (attempt ${attempt + 1}/${retries})`);
                    if (retryAfterSeconds) {
                        console.log(`Retry-After header: ${retryAfterSeconds} seconds`);
                    }
                    console.log(`Will retry after ${delay}ms (${(delay / 1000).toFixed(1)}s)`);
                    
                    if (attempt < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    return null;
                }
                
                console.error(`Roblox API error: ${response.status} ${response.statusText}`);
                // If it's a server error (5xx), retry. Otherwise, don't retry
                if (response.status >= 500 && attempt < retries - 1) {
                    continue;
                }
                return null;
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // Try to find exact match first (case-insensitive)
                const exactMatch = data.data.find((user: any) => 
                    user.name.toLowerCase() === username.toLowerCase()
                );
                if (exactMatch) {
                    return exactMatch; // { id, name, displayName }
                }
                // Otherwise return first result
                return data.data[0];
            }
            
            // If no results and we have retries left, try again
            if (attempt < retries - 1) {
                continue;
            }
            
            return null; // No user found after all retries
        } catch (error) {
            const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'));
            const isAbort = error instanceof Error && error.name === 'AbortError';
            
            if ((isTimeout || isAbort) && attempt < retries - 1) {
                console.warn(`Roblox API timeout/abort for ${username} (attempt ${attempt + 1}/${retries}), will retry...`);
                continue;
            }
            
            console.error(`Error fetching Roblox user (attempt ${attempt + 1}/${retries}):`, error);
            if (attempt === retries - 1) {
                return null; // Final attempt failed
            }
        }
    }
    
    return null;
}

export async function fetchRobloxAvatar(userId: string | number, retries: number = 2): Promise<string | null> {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = 2000 * attempt; // 2s, 4s delays
                console.log(`Retrying Roblox avatar fetch for user ${userId} (attempt ${attempt + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const response = await fetch(url, {
                cache: 'no-store',
                signal: createTimeoutSignal(20000) // 20 second timeout for avatar
            });
            
            if (!response.ok) {
                if (response.status >= 500 && attempt < retries - 1) {
                    continue;
                }
                return null;
            }
            
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                return data.data[0].imageUrl;
            }
            return null;
        } catch (error) {
            const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'));
            if (isTimeout && attempt < retries - 1) {
                continue;
            }
            console.error(`Error fetching Roblox avatar (attempt ${attempt + 1}/${retries}):`, error);
            if (attempt === retries - 1) {
                return null;
            }
        }
    }
    
    return null;
}

export async function fetchBatchAvatars(userIds: string[]) {
    if (userIds.length === 0) return {};
    try {
        const payload = userIds.map(id => ({
            requestId: id,
            targetId: parseInt(id),
            type: 'AvatarHeadShot',
            size: '420x420',
            format: 'Png',
            isCircular: false
        }));

        const response = await fetch('https://thumbnails.roblox.com/v1/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });

        const data = await response.json();

        const urlMap: Record<string, string> = {};
        if (data.data) {
            data.data.forEach((item: any) => {
                if (item.state === 'Completed' && item.imageUrl) {
                    urlMap[item.targetId.toString()] = item.imageUrl;
                }
            });
        }
        return urlMap;
    } catch (error) {
        console.error('Error fetching batch avatars:', error);
        return {};
    }
}
