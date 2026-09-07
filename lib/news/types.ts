export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
  imageUrl: string | null;
}
