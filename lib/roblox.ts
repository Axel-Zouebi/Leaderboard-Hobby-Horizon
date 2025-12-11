// lib/roblox.ts

export async function fetchRobloxUser(username: string) {
    try {
        const url = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
        console.log(`Fetching Roblox user from: ${url}`);
        const response = await fetch(url, {
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Roblox API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (data.data && data.data.length > 0) {
            return data.data[0]; // { id, name, displayName }
        }
        return null; // Silent fail if no user found
    } catch (error) {
        console.error('Error fetching Roblox user:', error);
        return null;
    }
}

export async function fetchRobloxAvatar(userId: string | number) {
    try {
        const response = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
            { cache: 'no-store' } // Ensure fresh avatar
        );
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].imageUrl;
        }
        return null;
    } catch (error) {
        console.error('Error fetching Roblox avatar:', error);
        return null;
    }
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
