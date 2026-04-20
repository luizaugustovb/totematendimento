import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setAuthToken } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  telefone?: string;
  cpf?: string;
  ativo: boolean;
  emailVerificado: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializar autenticação verificando localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const refreshTokenStored = localStorage.getItem('refreshToken');

        if (accessToken && refreshTokenStored) {
          // Configurar token no axios
          setAuthToken(accessToken);

          try {
            // Verificar se o token ainda é válido
            const response = await api.get('/auth/profile');
            setUser(response.data);
            setIsAuthenticated(true);
          } catch (error) {
            // Token provavelmente expirado, tentar renovar
            try {
              const refreshResponse = await api.post('/auth/refresh', {
                refreshToken: refreshTokenStored,
              });

              const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: userData } = refreshResponse.data;

              // Armazenar novos tokens
              localStorage.setItem('accessToken', newAccessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
              
              // Configurar novo token
              setAuthToken(newAccessToken);
              
              setUser(userData);
              setIsAuthenticated(true);
            } catch (refreshError) {
              // Falha ao renovar, limpar dados
              clearAuthData();
            }
          }
        }
      } catch (error) {
        console.error('Erro na inicialização da autenticação:', error);
        clearAuthData();
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Configurar interceptor para renovação automática de tokens
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshTokenStored = localStorage.getItem('refreshToken');
            
            if (refreshTokenStored) {
              const refreshResponse = await api.post('/auth/refresh', {
                refreshToken: refreshTokenStored,
              });

              const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;

              // Armazenar novos tokens
              localStorage.setItem('accessToken', newAccessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
              
              // Configurar novo token
              setAuthToken(newAccessToken);
              
              // Retry da requisição original
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return api(originalRequest);
            }
          } catch (refreshError) {
            clearAuthData();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        rememberMe,
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      // Armazenar tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Configurar token no axios
      setAuthToken(accessToken);

      // Atualizar estado
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Chamar endpoint de logout na API
      await api.post('/auth/logout');
    } catch (error) {
      // Continuar com logout local mesmo se falhar na API
      console.error('Erro no logout da API:', error);
    } finally {
      clearAuthData();
    }
  };

  const refreshToken = async () => {
    try {
      const refreshTokenStored = localStorage.getItem('refreshToken');
      
      if (!refreshTokenStored) {
        throw new Error('Refresh token não encontrado');
      }

      const response = await api.post('/auth/refresh', {
        refreshToken: refreshTokenStored,
      });

      const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: userData } = response.data;

      // Armazenar novos tokens
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Configurar novo token
      setAuthToken(newAccessToken);

      // Atualizar dados do usuário se fornecidos
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      clearAuthData();
      throw error;
    }
  };

  const clearAuthData = () => {
    // Limpar localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Limpar token do axios
    setAuthToken(null);

    // Limpar estado
    setUser(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isInitialized,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}