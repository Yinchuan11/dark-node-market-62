import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface NewsItem {
  content: string;
  created_at: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const NewsPanel: React.FC = () => {
  const [news, setNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from('news')
        .select('content, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error) setNews(data);
    };
    fetchLatest();

    const channel = supabase
      .channel('news-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, () => {
        fetchLatest();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!news) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>News</CardTitle>
        <CardDescription>Updated: {formatDate(news.created_at)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{news.content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsPanel;
