import React, { useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import { analyzeVideoContent } from './services/geminiService';
import { AnalysisStatus, AnalysisResult, VideoFile } from './types';
import { UploadIcon, BrainCircuitIcon, XIcon } from './components/Icons';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setError("For this demo, please use files under 25MB due to browser constraints.");
        return;
      }
      
      const url = URL.createObjectURL(file);
      setVideoFile({ file, previewUrl: url });
      setAnalysisStatus(AnalysisStatus.IDLE);
      setAnalysisResult(null);
      setError(null);
    }
  };

  const handleReset = () => {
    if (videoFile) URL.revokeObjectURL(videoFile.previewUrl);
    setVideoFile(null);
    setAnalysisStatus(AnalysisStatus.IDLE);
    setAnalysisResult(null);
    setError(null);
  };

  const startAnalysis = async () => {
    if (!videoFile) return;

    setAnalysisStatus(AnalysisStatus.ANALYZING);
    setError(null);

    try {
      const result = await analyzeVideoContent(videoFile.file);
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
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-red-500" />
             {error}
          </div>
        )}

        {/* Upload State */}
        {!videoFile && (
          <div className="border-2 border-dashed border-gray-700 rounded-3xl p-12 text-center hover:border-blue-500/50 hover:bg-gray-800/30 transition-all group cursor-pointer relative">
            <input 
              type="file" 
              accept="video/*,audio/*" 
              onChange={handleFileUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
              <div className="p-4 bg-gray-800 rounded-full group-hover:scale-110 transition-transform duration-300">
                <UploadIcon className="w-10 h-10 text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-medium text-gray-200">Drop your video here</p>
                <p className="text-sm text-gray-500 mt-1">MP4, WEBM, MOV (Max 25MB for demo)</p>
              </div>
            </div>
          </div>
        )}

        {/* Video Player State */}
        {videoFile && (
          <div className="space-y-6">
            
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded">
                        {videoFile.file.name}
                    </span>
                    {analysisStatus === AnalysisStatus.COMPLETED && (
                        <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full border border-green-800">
                            {analysisResult?.segments.length} skipped segments found
                        </span>
                    )}
                </div>
                <button 
                    onClick={handleReset}
                    className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
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
                        className="group relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-200 bg-blue-600 rounded-full hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 focus:ring-offset-gray-900"
                    >
                         <BrainCircuitIcon className="w-5 h-5 mr-2 animate-pulse" />
                         Analyze & Detect "Fluff"
                    </button>
                </div>
            )}

            {analysisResult && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mt-6">
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
    </div>
  );
};

export default App;