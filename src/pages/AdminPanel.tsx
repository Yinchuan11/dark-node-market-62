import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Plus, Users, Edit, Eye } from 'lucide-react';
import EditProductModal from '@/components/EditProductModal';
import NewsEditor from '@/components/NewsEditor';

const AdminPanel = () => {
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchUserCount();
    fetchAllProducts();
    
    // Set up real-time listener for user count
    const channel = supabase
      .channel('user-count-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        () => {
          fetchUserCount();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
  };

  const fetchUserCount = async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching user count:', error);
      return;
    }

    setUserCount(count || 0);
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    
    setIsLoading(true);
    
    const { error } = await supabase
      .from('categories')
      .insert({ name: newCategory.trim() });
    
    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Kategorie hinzugefügt",
        description: `${newCategory} wurde erfolgreich hinzugefügt.`
      });
      setNewCategory('');
      fetchCategories();
    }
    
    setIsLoading(false);
  };

  const fetchAllProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        profiles!products_seller_id_fkey(username)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    setProducts(data || []);
  };

  const removeCategory = async (categoryId: string, categoryName: string) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    
    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Kategorie entfernt",
        description: `${categoryName} wurde entfernt.`
      });
      fetchCategories();
    }
  };

  const deleteProduct = async (productId: string, productTitle: string) => {
    if (!confirm(`Sind Sie sicher, dass Sie das Produkt "${productTitle}" löschen möchten?`)) {
      return;
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      toast({
        title: "Fehler beim Löschen",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchAllProducts();
      toast({
        title: "Produkt gelöscht",
        description: "Das Produkt wurde erfolgreich gelöscht."
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/marketplace" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold font-cinzel">Admin Panel</h1>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/marketplace')}
          >
            Zurück zum Marktplatz
          </Button>
        </div>

        {/* User Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Benutzerstatistiken</span>
            </CardTitle>
            <CardDescription>
              Übersicht über registrierte Benutzer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {userCount} registrierte Nutzer
            </div>
          </CardContent>
        </Card>

<NewsEditor />

<Card>
          <CardHeader>
            <CardTitle>Kategorie Management</CardTitle>
            <CardDescription>
              Verwalten Sie die verfügbaren Produktkategorien
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <Label htmlFor="new-category">Neue Kategorie</Label>
                <Input
                  id="new-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Kategorie Name"
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={addCategory}
                  disabled={isLoading || !newCategory.trim()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Aktuelle Kategorien</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span>{category.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCategory(category.id, category.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All Products Management */}
        <Card>
          <CardHeader>
            <CardTitle>Produktverwaltung</CardTitle>
            <CardDescription>
              Verwalten Sie alle Produkte auf der Plattform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {products.map((product) => (
                <div key={product.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{product.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Kategorie: {product.category} | Verkäufer: {product.profiles?.username || 'Unbekannt'}
                      </p>
                      <p className="text-lg font-bold text-primary">€{product.price}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {product.is_active ? 'Aktiv' : 'Inaktiv'}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProduct(product);
                          setEditModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteProduct(product.id, product.title)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Löschen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  Noch keine Produkte vorhanden.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onProductUpdated={fetchAllProducts}
      />
    </div>
  );
};

export default AdminPanel;