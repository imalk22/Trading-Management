import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/news/format-relative-time";
import type { NewsArticle } from "@/lib/news/types";

export interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <Card>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt={article.title}
          className="h-40 w-full rounded-t-lg object-cover"
        />
      )}
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Badge variant="neutral">{article.source}</Badge>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(article.publishedAt)}</span>
        </div>
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-semibold hover:underline"
        >
          {article.title}
        </a>
        <p className="line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
      </CardContent>
    </Card>
  );
}
