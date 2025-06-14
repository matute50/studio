
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
  id: string; // ID should not be optional if it's a primary key from DB
  nombre: string;
  url_de_streaming: string;
  isActive: boolean;
  createdAt?: string; // Database can set this on creation (e.g., with DEFAULT now())
  updatedAt?: string; // Database trigger will manage this on updates
}

export interface HeaderImageItem {
  id: string;
  nombre: string;
  imageUrl: string;
  mode: 'light' | 'dark';
  createdAt: string; // Assuming this is set by DB or required on creation
  updatedAt: string; // Assuming this is set by DB or required on creation/update
}

