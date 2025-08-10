import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');

  // Load theme from user profile or localStorage
  useEffect(() => {
    const loadTheme = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (!error && data?.theme_preference) {
            const savedTheme = data.theme_preference as Theme;
            setThemeState(savedTheme);
            applyTheme(savedTheme);
          } else {
            // Fallback to localStorage for anonymous users
            const savedTheme = localStorage.getItem('theme') as Theme || 'light';
            setThemeState(savedTheme);
            applyTheme(savedTheme);
          }
        } catch (error) {
          console.error('Error loading theme:', error);
          // Fallback to localStorage
          const savedTheme = localStorage.getItem('theme') as Theme || 'light';
          setThemeState(savedTheme);
          applyTheme(savedTheme);
        }
      } else {
        // For non-authenticated users, use localStorage
        const savedTheme = localStorage.getItem('theme') as Theme || 'light';
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      }
    };

    loadTheme();
  }, [user]);

  const applyTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Save to user profile if authenticated
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ theme_preference: newTheme } as any)
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};