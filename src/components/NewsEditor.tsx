import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const NewsEditor: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const wrapSelection = (wrapper: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const newText = `${before}${wrapper}${selected}${wrapper}${after}`;
    setContent(newText);
    // restore selection
    requestAnimationFrame(() => {
      const pos = start + wrapper.length + selected.length + wrapper.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!content.trim()) {
      toast({ title: 'Inhalt erforderlich', description: 'Bitte Text eingeben.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('news').insert({ content, author_id: user.id });
    setSaving(false);
    if (error) {
      toast({ title: 'Fehler beim Veröffentlichen', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'News veröffentlicht', description: 'Die Neuigkeit wurde gespeichert.' });
      setContent('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>News Editor</CardTitle>
        <CardDescription>Schreiben Sie Updates mit Fett/Kursiv (Markdown unterstützt).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => wrapSelection('**')}>
            Fett
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => wrapSelection('*')}>
            Kursiv
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          rows={6}
          placeholder="Schreiben Sie hier Ihre Neuigkeit..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end">
          <Button onClick={handlePublish} disabled={saving}>
            {saving ? 'Speichern...' : 'Veröffentlichen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsEditor;
