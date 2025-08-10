import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Moon, Sun, Trash2, Shield, Download, ExternalLink, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeletingAccount(true);
    try {
      // Call edge function to properly delete the account
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        method: 'POST'
      });

      if (error) {
        throw error;
      }

      // Sign out and redirect
      await signOut();
      
      toast({
        title: 'Account Deleted',
        description: 'Your account has been successfully deleted.',
      });

      navigate('/auth');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'Account could not be deleted.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/marketplace')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              Appearance
            </CardTitle>
            <CardDescription>
              Choose between light and dark mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-toggle" className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Light
              </Label>
              <Switch
                id="theme-toggle"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
              <Label htmlFor="theme-toggle" className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Dark
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security Guide */}
        <Card id="privacy-guide">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Anonymity
            </CardTitle>
            <CardDescription>
              Guidelines for anonymous and secure platform usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. Use Tor Browser</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Tor Browser routes your traffic through multiple servers and obscures your IP address.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://www.torproject.org/download/" target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download Tor Browser
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">2. VPN Providers</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Recommended VPN providers for additional anonymity:
                </p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• <strong>Mullvad:</strong> No logs, anonymous payment possible</li>
                  <li>• <strong>ProtonVPN:</strong> Swiss provider, strong encryption</li>
                  <li>• <strong>IVPN:</strong> No-logs policy, anonymous accounts</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">3. Bitcoin Anonymity</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Bitcoin transactions are publicly visible. Use:
                </p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• <strong>Coin-Mixing Services:</strong> Wasabi Wallet, Samourai Whirlpool</li>
                  <li>• <strong>New Addresses:</strong> Use new Bitcoin address for each transaction</li>
                  <li>• <strong>Monero:</strong> As alternative cryptocurrency (if supported)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">4. Platform Behavior</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Do not use real names as username</li>
                  <li>• Delete and recreate account regularly</li>
                  <li>• Do not reuse passwords</li>
                  <li>• Clear browser data after each session</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">5. Additional Tools</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://tails.boum.org/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Tails OS
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://www.whonix.org/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Whonix
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Account Management
            </CardTitle>
            <CardDescription>
              Manage your user account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Your account, 
                    all your data and your Bitcoin address will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingAccount ? 'Deleting...' : 'Delete Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}