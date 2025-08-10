import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  if (user && !loading) {
    return <Navigate to="/marketplace" replace />;
  }

  const handleSignIn = async (username: string, password: string) => {
    setIsLoading(true);

    const { error } = await signIn(username, password);
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Successfully signed in",
        description: "Welcome back!"
      });
    }
    
    setIsLoading(false);
  };

  const handleUserSignUp = async (username: string, password: string) => {
    setIsLoading(true);

    const { error } = await signUp(username, password, false);
    
    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('User already registered')) {
        errorMessage = 'This username is already registered';
      }
      
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Registration successful",
        description: "User account has been created!"
      });
    }
    
    setIsLoading(false);
  };

  const handleSellerSignUp = async (username: string, password: string) => {
    setIsLoading(true);

    const { error } = await signUp(username, password, true);
    
    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('User already registered')) {
        errorMessage = 'This username is already registered';
      }
      
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Registration successful",
        description: "Seller account has been created!"
      });
    }
    
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <h1 className="text-3xl font-bold font-cinzel">Oracle Market</h1>
          </div>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
            <TabsTrigger value="seller">Seller</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <SignInForm
              onSubmit={handleSignIn}
              isLoading={isLoading}
            />
          </TabsContent>
          
          <TabsContent value="signup">
            <SignUpForm
              onSubmit={handleUserSignUp}
              isLoading={isLoading}
              title="User Registration"
              description="Create a new user account"
            />
          </TabsContent>

          <TabsContent value="seller">
            <SignUpForm
              onSubmit={handleSellerSignUp}
              isLoading={isLoading}
              title="Seller Registration"
              description="Create a seller account"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;