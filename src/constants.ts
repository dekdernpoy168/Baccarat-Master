export const API_BASE = '';

export interface Author {
  id: number;
  name: string;
  position: string;
  description: string;
  image: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Article {
  id: string | number;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  categorySlug?: string;
  date: string;
  author: string;
  author_id?: number | string | null;
  author_data?: Author | null; // Optional attached author data
  image: string;
  slug: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  publishedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  status?: string;
  type?: string; // 'post' or 'page'
  tags?: string;
  faqs?: string; // JSON string of { question: string, answer: string }[]
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

// Production ready defaults (Empty)
export const ARTICLES: Article[] = [];
export const AUTHORS: Author[] = [];
