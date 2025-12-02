export const isYoutubeUrl = (url: string) => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

export const resolveYoutubeUrl = async (url: string): Promise<string> => {
  // Using cobalt.tools public API to resolve media links
  // This is a robust, free, and open-source media downloader API
  const api = 'https://api.cobalt.tools/api/json';
  
  try {
    const response = await fetch(api, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        vCodec: 'h264',
        vQuality: '480', // Prefer lower quality (480p) to keep file size small for the demo
        filenamePattern: 'basic',
        isAudioOnly: false
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.text || 'Could not resolve YouTube video');
    }

    if (data.status === 'picker') {
        // If it returns multiple options, pick the first video
        const item = data.picker.find((p: any) => p.type === 'video');
        if (item) return item.url;
        throw new Error('No video stream found');
    }

    if (data.status === 'stream' || data.status === 'redirect') {
        return data.url;
    }

    throw new Error('Unexpected response from resolver');

  } catch (error) {
    console.error('YouTube Resolution Error:', error);
    throw new Error('Failed to resolve YouTube URL. The video might be restricted, private, or too long.');
  }
};