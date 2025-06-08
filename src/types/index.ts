
export interface NewsArticle {
  id?: string;
  title: string;
  text: string;
  imageUrl: string;
  featureStatus: 'destacada' | 'noticia2' | 'noticia3' | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TextoTicker {
  id?: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface CalendarEvent {
  id?: string;
  name: string;
  eventDateTime: string; // Stored as ISO string
  createdAt?: string;
  updatedAt?: string;
}

export interface Advertisement {
  id?: string;
  name: string;
  imageUrl: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface VideoItem {
  id?: string;
  nombre: string;
  url: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InterviewItem {
  id?: string;
  nombre: string;
  url: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BannerItem {
  id?: string;
  nombre: string;
  imageUrl: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface StreamingConfig {
  id: string; // Should be a fixed value like 'main_stream_config'
  url_de_streaming: string;
  updated_at?: string;
}
