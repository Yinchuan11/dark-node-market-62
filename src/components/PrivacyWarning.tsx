import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function PrivacyWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [isUsingTor, setIsUsingTor] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Only show warning for logged in users
    if (!user) return;
    
    // Check if user has already seen the warning
    const hasSeenWarning = localStorage.getItem('oracle-privacy-warning-seen');
    
    if (!hasSeenWarning) {
      // Small delay to ensure component is properly mounted and user state is set
      const timer = setTimeout(() => {
        // Check for Tor Browser
        const userAgent = navigator.userAgent;
        const isTorBrowser = userAgent.includes('Tor') || 
                            userAgent.includes('Firefox') && userAgent.includes('rv:') && 
                            !userAgent.includes('Chrome');
        
        setIsUsingTor(isTorBrowser);
        setShowWarning(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleAcceptRisk = () => {
    localStorage.setItem('oracle-privacy-warning-seen', 'true');
    setShowWarning(false);
  };

  const handleGetTorGuide = () => {
    // Mark warning as seen so it doesn't show again
    localStorage.setItem('oracle-privacy-warning-seen', 'true');
    setShowWarning(false);
    
    if (!user) {
      // Redirect to auth with return URL
      window.location.href = '/auth?redirect=/settings#privacy-guide';
    } else {
      // User is logged in, go directly to settings
      window.location.href = '/settings#privacy-guide';
    }
  };

  if (!showWarning) return null;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-yellow-500" />
            Privacy & Security Notice
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            <div className="space-y-3">

              {!isUsingTor && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    <strong>Warning:</strong> You are not using Tor Browser. Your real IP address is visible.
                  </AlertDescription>
                </Alert>
              )}

              {isUsingTor && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <strong>Good:</strong> Tor Browser detected. Your IP is better protected.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-medium">Recommended Security Measures:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>• Use Tor Browser or VPN</li>
                <li>• Avoid real names as username</li>
                
                <li>• Delete account regularly</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleGetTorGuide} className="w-full sm:w-auto">
            View Security Guide
          </Button>
          <AlertDialogAction onClick={handleAcceptRisk} className="w-full sm:w-auto">
            Understood, Accept Risk
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}