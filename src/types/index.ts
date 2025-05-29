
export interface NewsArticle {
  id?: string;
  title: string;
  text: string;
  imageUrl: string; 
  isFeatured: boolean;
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
  isActive?: boolean; // Nuevo campo
}

