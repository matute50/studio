

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
  color?: string;
}

export interface CalendarEvent {
  id?: string;
  name: string;
  eventDateTime: string; // Stored as ISO string
  createdAt?: string;
  updatedAt?: string;
  imagen?: string | null;
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
  imagen?: string | null;
  novedad?: boolean;
  forzar_video?: boolean;
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
  url: string;
  isActive: boolean;
  imagen?: string | null;
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

export interface StreamVideosToggle {
  id: number;
  stream: boolean;
  isAuto: boolean;
  updatedAt?: string;
}
