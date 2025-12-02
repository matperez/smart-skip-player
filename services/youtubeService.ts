export const isYoutubeUrl = (url: string) => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

export const resolveYoutubeUrl = async (url: string): Promise<string> => {
  // Reliable instances that usually support CORS headers for frontend requests
  const instances = [
    'https://co.wuk.sh/api/json',
    'https://api.succubus.space/api/json',
    'https://cobalt.kwiatekmiki.pl/api/json',
    'https://cobalt.qkv.fun/api/json',
    'https://api.cobalt.tools/api/json',
    'https://cobalt.slpy.one/api/json',
    'https://api.server.exelban.com/api/json',
    'https://cobalt.xy2401.com/api/json',
    'https://cobalt.arms.nu/api/json'
  ];
  
  // 1. Sanitize URL
  let cleanUrl = url;
  try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'youtu.be') {
          cleanUrl = `https://www.youtube.com/watch?v=${urlObj.pathname.slice(1)}`;
      } else if (urlObj.hostname.includes('youtube.com')) {
          const v = urlObj.searchParams.get('v');
          if (v) {
              cleanUrl = `https://www.youtube.com/watch?v=${v}`;
          }
      }
  } catch (e) {
      console.warn("URL sanitization failed, using original:", e);
  }

  let lastError = null;

  // 2. Try each instance
  for (const apiBase of instances) {
    try {
        const body = JSON.stringify({
            url: cleanUrl,
            filenamePattern: 'basic',
        });
        
        // Direct fetch only. Do not use generic CORS proxies for the API call itself 
        // as they often break POST JSON bodies or strip headers.
        const response = await fetch(apiBase, { 
            method: 'POST', 
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body 
        });

        // Strict Content-Type check to avoid parsing HTML error pages
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
             throw new Error(`Invalid content-type: ${contentType}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.text || 'Resolver returned error');
        }

        if (data.status === 'picker') {
            const item = data.picker.find((p: any) => p.type === 'video');
            if (item) return item.url;
            throw new Error('No video stream found in picker');
        }

        if (data.status === 'stream' || data.status === 'redirect') {
            return data.url;
        }
        
        throw new Error('Unexpected response format');

    } catch (error: any) {
        lastError = error;
        // Continue to next instance loop
    }
  }

  console.error('All YouTube resolvers failed.', lastError);
  throw new Error('Failed to resolve YouTube URL. The video might be restricted, or servers are busy. Please try again.');
};