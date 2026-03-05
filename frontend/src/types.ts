export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface ProgressEvent {
  job_id: string;
  step: string;
  current: number;
  total: number;
  message: string;
}

export interface WikiArticleOut {
  title: string;
  url: string;
  image_count: number;
  needs_photo: boolean;
}

export interface CommonsOut {
  nearby_image_count: number;
  saturation: string;
}

export interface QualityOut {
  megapixels: number;
  overall_suitable: boolean;
}

export interface OpportunityOut {
  filename: string;
  latitude: number;
  longitude: number;
  location_name: string;
  score: number;
  recommendation: string;
  reasons: string[];
  best_article: WikiArticleOut | null;
  commons: CommonsOut | null;
  quality: QualityOut | null;
  thumbnail_b64: string | null;
}

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  message: string;
}

export interface ResultsResponse {
  job_id: string;
  total_photos: number;
  opportunities: OpportunityOut[];
}
