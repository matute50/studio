
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
}
