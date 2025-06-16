
export interface NewsArticle {
  id?: string;
  title: string;
  text: string;
  imageUrl: string;
  featureStatus: 'destacada' | 'noticia2' | 'noticia3' | null;
  slug?: string; 
  description?: string; 
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
  categoria?: string | null;
  imagen?: string | null; // Added for video thumbnail/image
  // fecha field removed as per previous instructions, but can be re-added if needed
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
  id?: string; 
  nombre: string;
  url_de_streaming: string;
  isActive: boolean;
  createdAt?: string; 
  updatedAt?: string; 
}

export interface HeaderImageItem {
  id: string;
  nombre: string;
  imageUrl: string;
  mode: 'light' | 'dark';
  createdAt: string; 
  updatedAt: string; 
}
