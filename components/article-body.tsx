import { articleHtml } from '@/lib/article';
export default function ArticleBody({
  body,
  format,
}: {
  body: string;
  format?: string;
}) {
  return (
    <div
      className="article-body"
      dangerouslySetInnerHTML={{ __html: articleHtml(body, format) }}
    />
  );
}
