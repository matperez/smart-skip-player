export interface SkipSegment {
  start: number;
  end: number;
  reason: string;
}

export interface AnalysisResult {
  segments: SkipSegment[];
  summary: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface VideoFile {
  file: File;
  previewUrl: string;
}
