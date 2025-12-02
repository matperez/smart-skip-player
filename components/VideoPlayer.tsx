import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SkipSegment } from '../types';
import { PlayIcon, PauseIcon, BrainCircuitIcon, SparklesIcon, FastForwardIcon } from './Icons';

interface VideoPlayerProps {
  src: string;
  skipSegments: SkipSegment[];
  isAnalyzing: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, skipSegments, isAnalyzing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [smartSkipEnabled, setSmartSkipEnabled] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState<string | null>(null);

  // Toggle playback
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Handle time update for progress bar and smart skipping
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      if (smartSkipEnabled && skipSegments.length > 0) {
        // Find if current time is inside a skip segment
        const currentSegment = skipSegments.find(
          seg => time >= seg.start && time < seg.end
        );

        if (currentSegment) {
          // Trigger skip
          setIsSkipping(true);
          setSkipReason(currentSegment.reason);
          videoRef.current.currentTime = currentSegment.end;
          
          // Small visual feedback reset
          setTimeout(() => {
             setIsSkipping(false);
             setSkipReason(null);
          }, 800);
        }
      }
    }
  }, [smartSkipEnabled, skipSegments]);

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Handle Seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && videoRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Handle Speed Change
  const changeSpeed = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    // If setting to high speed, suggest or auto-enable smart skip? 
    // For now, keep them independent but accessible.
  };

  // Toggle Smart Skip
  const toggleSmartSkip = () => {
    setSmartSkipEnabled(!smartSkipEnabled);
  };

  // Activate "Smart x2"
  const activateSmartTurbo = () => {
    setPlaybackRate(2.0);
    setSmartSkipEnabled(true);
    if(videoRef.current) videoRef.current.playbackRate = 2.0;
  };

  // Format time helper
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 relative group">
      {/* Video Element */}
      <div className="relative bg-black aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />
        
        {/* Loading / Analyzing Overlay */}
        {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                <BrainCircuitIcon className="text-primary-400 w-16 h-16 animate-pulse mb-4" />
                <p className="text-white text-lg font-medium">Analyzing content with Gemini AI...</p>
                <p className="text-gray-400 text-sm mt-2">Detecting silence and filler words</p>
            </div>
        )}

        {/* Skip Notification Overlay */}
        <div className={`absolute top-6 right-6 bg-purple-600/90 text-white px-4 py-2 rounded-full flex items-center gap-2 transform transition-all duration-300 pointer-events-none ${isSkipping ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90'}`}>
            <FastForwardIcon className="w-4 h-4" />
            <span className="text-sm font-bold">Skipped: {skipReason || 'Insignificant'}</span>
        </div>

        {/* Center Play Button (only when paused and not analyzing) */}
        {!isPlaying && !isAnalyzing && (
          <button 
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors group-hover:opacity-100 opacity-0"
          >
            <div className="bg-white/20 backdrop-blur-md p-6 rounded-full border border-white/30 text-white hover:scale-110 transition-transform">
                <PlayIcon className="w-12 h-12 fill-white" />
            </div>
          </button>
        )}
      </div>

      {/* Controls Container */}
      <div className="p-4 space-y-4 bg-gray-900/95 backdrop-blur-lg">
        
        {/* Progress Bar */}
        <div 
            ref={progressBarRef}
            className="relative h-2 bg-gray-700 rounded-full cursor-pointer hover:h-3 transition-all duration-200 group/timeline"
            onClick={handleSeek}
        >
            {/* Base Progress */}
            <div 
                className="absolute top-0 left-0 h-full bg-primary-500 rounded-full z-10"
                style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Skip Segments Highlights */}
            {smartSkipEnabled && skipSegments.map((seg, idx) => (
                <div
                    key={idx}
                    className="absolute top-0 h-full bg-purple-500/50 z-0 hover:bg-purple-400/80 transition-colors"
                    style={{
                        left: `${(seg.start / duration) * 100}%`,
                        width: `${((seg.end - seg.start) / duration) * 100}%`
                    }}
                    title={`Skip: ${seg.reason}`}
                />
            ))}
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button onClick={togglePlay} className="text-white hover:text-primary-400 transition-colors">
                    {isPlaying ? <PauseIcon className="w-6 h-6 fill-current" /> : <PlayIcon className="w-6 h-6 fill-current" />}
                </button>
                
                {/* Time Display */}
                <div className="text-sm font-mono text-gray-400">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
            </div>

            <div className="flex items-center gap-3">
                
                {/* Regular Speed Dropdown */}
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                    <button 
                        onClick={() => changeSpeed(1.0)} 
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${playbackRate === 1.0 && !smartSkipEnabled ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        1x
                    </button>
                    <button 
                        onClick={() => changeSpeed(1.5)} 
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${playbackRate === 1.5 && !smartSkipEnabled ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        1.5x
                    </button>
                    <button 
                        onClick={() => changeSpeed(2.0)} 
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${playbackRate === 2.0 && !smartSkipEnabled ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        2x
                    </button>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-gray-700 mx-1"></div>

                {/* Smart Controls */}
                <div className="flex items-center gap-2">
                    {/* Just Smart Skip Toggle */}
                    <button
                        onClick={toggleSmartSkip}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            smartSkipEnabled && playbackRate < 2.0
                                ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                        title="Skip silence and filler without speeding up"
                    >
                        <BrainCircuitIcon className="w-4 h-4" />
                        <span className="text-xs font-semibold">Smart Skip</span>
                    </button>

                    {/* SMART TURBO (The "x2" request) */}
                    <button
                        onClick={activateSmartTurbo}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                             smartSkipEnabled && playbackRate === 2.0
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-lg shadow-purple-900/50' 
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                        title="2x Speed + Auto-skip fluff"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span className="text-xs font-bold">Smart x2</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;