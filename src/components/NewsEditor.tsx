import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Edit, Trash2, Plus } from 'lucide-react';

interface NewsItem {
  id: string;
  content: string;
  created_at: string;
}

const NewsEditor: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching news:', error);
    } else {
      setNews(data || []);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!content.trim()) {
      toast({ title: 'Inhalt erforderlich', description: 'Bitte Text eingeben.' });
      return;
    }
    setSaving(true);
    
    if (editingId) {
      // Update existing news
      const { error } = await supabase
        .from('news')
        .update({ content })
        .eq('id', editingId);
      
      if (error) {
        toast({ title: 'Fehler beim Aktualisieren', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'News aktualisiert', description: 'Die Neuigkeit wurde aktualisiert.' });
        setContent('');
        setEditingId(null);
        fetchNews();
      }
    } else {
      // Create new news
      const { error } = await supabase.from('news').insert({ content, author_id: user.id });
      
      if (error) {
        toast({ title: 'Fehler beim Veröffentlichen', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'News veröffentlicht', description: 'Die Neuigkeit wurde gespeichert.' });
        setContent('');
        fetchNews();
      }
    }
    setSaving(false);
  };

  const handleEdit = (newsItem: NewsItem) => {
    setContent(newsItem.content);
    setEditingId(newsItem.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Neuigkeit löschen möchten?')) return;
    
    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Fehler beim Löschen', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'News gelöscht', description: 'Die Neuigkeit wurde gelöscht.' });
      fetchNews();
    }
  };

  const cancelEdit = () => {
    setContent('');
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>News Editor</CardTitle>
          <CardDescription>
            {editingId ? 'Bearbeiten Sie die Neuigkeit' : 'Schreiben Sie neue Updates (Markdown unterstützt)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            ref={textareaRef}
            rows={6}
            placeholder="Schreiben Sie hier Ihre Neuigkeit..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex justify-between">
            <div>
              {editingId && (
                <Button variant="outline" onClick={cancelEdit}>
                  Abbrechen
                </Button>
              )}
            </div>
            <Button onClick={handlePublish} disabled={saving}>
              {saving ? 'Speichern...' : (editingId ? 'Aktualisieren' : 'Veröffentlichen')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gespeicherte News</CardTitle>
          <CardDescription>Verwalten Sie Ihre veröffentlichten Neuigkeiten</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {news.map((item) => (
              <div key={item.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm">{item.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {news.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                Noch keine News vorhanden.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewsEditor;
