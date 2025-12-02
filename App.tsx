import React, { useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import { analyzeVideoContent } from './services/geminiService';
import { isYoutubeUrl, resolveYoutubeUrl } from './services/youtubeService';
import { AnalysisStatus, AnalysisResult, VideoFile } from './types';
import { UploadIcon, BrainCircuitIcon, XIcon, LinkIcon, YoutubeIcon } from './components/Icons';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');

  // New states for URL handling
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string>('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFile({ file, previewUrl: url });
      setAnalysisStatus(AnalysisStatus.IDLE);
      setAnalysisResult(null);
      setError(null);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsDownloading(true);
    setError(null);
    setDownloadStatus('Initializing...');

    try {
        let fetchUrl = urlInput;
        const isYT = isYoutubeUrl(urlInput);

        // 1. Resolve YouTube URL if necessary
        if (isYT) {
            setDownloadStatus('Resolving YouTube stream...');
            fetchUrl = await resolveYoutubeUrl(urlInput);
        }

        // 2. Fetch the video data with robust fallback
        setDownloadStatus(isYT ? 'Downloading video data (via Proxy)...' : 'Downloading video...');
        
        // Strategy: Try multiple proxy services if the first fails
        const proxyStrategies = [
            (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
            (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
            (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
        ];

        let blob: Blob | null = null;
        let lastError;

        // Try proxies first (needed for most external video links due to CORS)
        for (const createProxy of proxyStrategies) {
            try {
                const proxyUrl = isYT ? createProxy(fetchUrl) : fetchUrl; 
                // Note: If not YT, we try direct first usually, but for this loop we can assume proxy needed for external URL
                // Let's adjust: if not YT, try direct first, then proxies.
                
                if (!isYT && createProxy === proxyStrategies[0]) {
                     try {
                         const res = await fetch(fetchUrl);
                         if (res.ok) {
                             blob = await res.blob();
                             break;
                         }
                     } catch(e) {}
                }

                const res = await fetch(createProxy(fetchUrl));
                if (!res.ok) throw new Error(`Status ${res.status}`);
                blob = await res.blob();
                break; // Success
            } catch (err) {
                lastError = err;
                continue;
            }
        }

        if (!blob) {
            throw new Error(`Failed to download video. ${lastError?.message || ''}`);
        }
        
        // Create a File object from the blob
        const fileName = isYT ? 'youtube_video.mp4' : (urlInput.split('/').pop()?.split('?')[0] || 'video.mp4');
        const file = new File([blob], fileName, { type: blob.type || 'video/mp4' });
        const url = URL.createObjectURL(file);
        
        setVideoFile({ file, previewUrl: url });
        setAnalysisStatus(AnalysisStatus.IDLE);
        setAnalysisResult(null);
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Could not download video. Please check the URL.");
    } finally {
        setIsDownloading(false);
        setDownloadStatus('');
    }
  };

  const handleReset = () => {
    if (videoFile) URL.revokeObjectURL(videoFile.previewUrl);
    setVideoFile(null);
    setAnalysisStatus(AnalysisStatus.IDLE);
    setAnalysisResult(null);
    setError(null);
    setUrlInput('');
    setIsDownloading(false);
    setProgressMessage('');
  };

  const startAnalysis = async () => {
    if (!videoFile) return;

    setAnalysisStatus(AnalysisStatus.ANALYZING);
    setProgressMessage("Starting analysis...");
    setError(null);

    try {
      const result = await analyzeVideoContent(videoFile.file, (status) => {
          setProgressMessage(status);
      });
      setAnalysisResult(result);
      setAnalysisStatus(AnalysisStatus.COMPLETED);
    } catch (err: any) {
      setError(err.message || "Failed to analyze video. Please try again or check API key.");
      setAnalysisStatus(AnalysisStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-10 space-y-2">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">
          SmartSkip Player
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto text-lg">
          Don't just watch faster. Watch smarter. 
          <br />
          <span className="text-sm text-gray-500">Gemini AI detects and skips the boring parts for you.</span>
        </p>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-5xl">
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 flex items-start gap-3 animate-fade-in">
             <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
             <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Upload / Input State */}
        {!videoFile && (
          <div className="w-full max-w-2xl mx-auto">
             {/* Tabs */}
             <div className="flex p-1 bg-gray-800/50 rounded-xl mb-6 w-fit mx-auto border border-gray-700">
                <button 
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  <UploadIcon className="w-4 h-4" />
                  Upload File
                </button>
                <button 
                  onClick={() => setActiveTab('url')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'url' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                >
                  <YoutubeIcon className="w-4 h-4" />
                  YouTube / URL
                </button>
             </div>

             {activeTab === 'upload' ? (
                <div className="border-2 border-dashed border-gray-700 rounded-3xl p-12 text-center hover:border-blue-500/50 hover:bg-gray-800/30 transition-all group cursor-pointer relative bg-gray-800/20">
                    <input 
                    type="file" 
                    accept="video/*,audio/*" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
                    <div className="p-4 bg-gray-800 rounded-full group-hover:scale-110 transition-transform duration-300 shadow-lg">
                        <UploadIcon className="w-10 h-10 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xl font-medium text-gray-200">Drop your video here</p>
                        <p className="text-sm text-gray-500 mt-1">MP4, WEBM, MOV (No Size Limit)</p>
                    </div>
                    </div>
                </div>
             ) : (
                <div className="bg-gray-800/20 border border-gray-700 rounded-3xl p-8 sm:p-12">
                   <form onSubmit={handleUrlSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 ml-1">Paste Video Link</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <YoutubeIcon className={`h-5 w-5 ${isYoutubeUrl(urlInput) ? 'text-red-500' : 'text-gray-500'} transition-colors`} />
                            </div>
                            <input
                                type="url"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="https://youtube.com/watch?v=... or .mp4 link"
                                className="block w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-500 ml-1">
                           Supports direct files and YouTube links. Large videos are automatically chunked.
                        </p>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isDownloading || !urlInput}
                        className={`w-full py-4 rounded-xl font-semibold text-white transition-all transform flex items-center justify-center gap-2 ${
                            isDownloading 
                            ? 'bg-gray-700 cursor-wait' 
                            : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 hover:scale-[1.02] shadow-lg'
                        }`}
                      >
                        {isDownloading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {downloadStatus || 'Processing...'}
                            </>
                        ) : (
                            <>Load Video</>
                        )}
                      </button>
                   </form>
                </div>
             )}
          </div>
        )}

        {/* Video Player State */}
        {videoFile && (
          <div className="space-y-6 animate-fade-in-up">
            
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded max-w-[200px] truncate">
                        {videoFile.file.name}
                    </span>
                    {analysisStatus === AnalysisStatus.COMPLETED && (
                        <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full border border-green-800 animate-pulse-slow">
                            {analysisResult?.segments.length} skipped segments
                        </span>
                    )}
                </div>
                <button 
                    onClick={handleReset}
                    className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-sm hover:bg-gray-800 px-3 py-1.5 rounded-lg"
                >
                    <XIcon className="w-4 h-4" /> Change Video
                </button>
            </div>

            <VideoPlayer 
                src={videoFile.previewUrl}
                skipSegments={analysisResult?.segments || []}
                isAnalyzing={analysisStatus === AnalysisStatus.ANALYZING}
            />

            {/* Analysis Prompt / Summary Area */}
            {analysisStatus === AnalysisStatus.IDLE && (
                <div className="flex justify-center mt-8">
                    <button
                        onClick={startAnalysis}
                        className="group relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-200 bg-blue-600 rounded-full hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 focus:ring-offset-gray-900 shadow-lg shadow-blue-900/20"
                    >
                         <BrainCircuitIcon className="w-5 h-5 mr-2" />
                         Analyze & Detect "Fluff"
                    </button>
                </div>
            )}
            
            {analysisStatus === AnalysisStatus.ANALYZING && (
                <div className="flex flex-col items-center justify-center mt-6 p-4 rounded-lg bg-gray-800/30">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                    <p className="text-blue-300 text-sm font-medium animate-pulse">{progressMessage || "Analyzing..."}</p>
                </div>
            )}

            {analysisResult && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mt-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                        <span className="text-2xl">📝</span> AI Summary
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                        {analysisResult.summary}
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Detected Skips</h4>
                        <div className="flex flex-wrap gap-2">
                            {analysisResult.segments.slice(0, 5).map((seg, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-900 rounded border border-gray-700 text-xs text-gray-400">
                                    {Math.floor(seg.start)}s - {Math.floor(seg.end)}s ({seg.reason})
                                </span>
                            ))}
                            {analysisResult.segments.length > 5 && (
                                <span className="px-3 py-1 bg-gray-900 rounded border border-gray-700 text-xs text-gray-500">
                                    +{analysisResult.segments.length - 5} more
                                </span>
                            )}
                            {analysisResult.segments.length === 0 && (
                                <span className="text-gray-500 italic text-sm">No significant silence or filler detected. Good job!</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-fade-in-up {
            animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;