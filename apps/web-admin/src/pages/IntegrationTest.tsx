import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface SystemHealth {
  status: string;
  timestamp: string;
  uptime: number;
  memory: any;
  services: {
    api: boolean;
    database: boolean;
    storage: boolean;
    processing: boolean;
  };
  config: {
    environment: string;
    version: string;
  };
}

interface ConnectionStats {
  totalConnections: number;
  authenticatedUsers: number;
  roomDistribution: Record<string, number>;
}

export const IntegrationTestPage: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    setTestResults(prev => ({ ...prev, [testName]: 'pending' }));
    addLog(`Iniciando teste: ${testName}`);
    
    try {
      await testFn();
      setTestResults(prev => ({ ...prev, [testName]: 'success' }));
      addLog(`✅ ${testName} - Sucesso`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testName]: 'error' }));
      addLog(`❌ ${testName} - Erro: ${error.message}`);
      console.error(`Test ${testName} failed:`, error);
    }
  };

  // Test API connectivity
  const testApiConnectivity = async () => {
    const response = await fetch('/api/integration/health', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    setSystemHealth(data);
    
    if (data.status !== 'ok') {
      throw new Error(`System status: ${data.status}`);
    }
  };

  // Test dashboard stats
  const testDashboardStats = async () => {
    const response = await fetch('/api/integration/dashboard/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (typeof data.totalDocuments !== 'number') {
      throw new Error('Invalid dashboard stats format');
    }
  };

  // Test recent activities
  const testRecentActivities = async () => {
    const response = await fetch('/api/integration/dashboard/activities', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Activities should be an array');
    }
  };

  // Test app config
  const testAppConfig = async () => {
    const response = await fetch('/api/integration/config', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || !data.limits) {
      throw new Error('Invalid config format');
    }
  };

  // Test WebSocket connection
  const testWebSocket = async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      const ws = new WebSocket(`ws://localhost:3000/realtime`);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        addLog('WebSocket conectado com sucesso');
        ws.close();
        resolve();
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };
    });
  };

  // Run all tests
  const runAllTests = async () => {
    setIsLoading(true);
    setTestResults({});
    setLogs([]);
    
    const tests = [
      { name: 'API Connectivity', fn: testApiConnectivity },
      { name: 'Dashboard Stats', fn: testDashboardStats },
      { name: 'Recent Activities', fn: testRecentActivities },
      { name: 'App Config', fn: testAppConfig },
      { name: 'WebSocket Connection', fn: testWebSocket },
    ];

    for (const test of tests) {
      await runTest(test.name, test.fn);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsLoading(false);
    addLog('Todos os testes concluídos');
  };

  const getTestIcon = (status: 'success' | 'error' | 'pending' | undefined) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Teste de Integração do Sistema</h1>
        <Button 
          onClick={runAllTests} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Executando Testes...' : 'Executar Todos os Testes'}
        </Button>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados dos Testes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              'API Connectivity',
              'Dashboard Stats', 
              'Recent Activities',
              'App Config',
              'WebSocket Connection'
            ].map(testName => (
              <div key={testName} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">{testName}</span>
                <div className="flex items-center gap-2">
                  {getTestIcon(testResults[testName])}
                  <Badge variant={
                    testResults[testName] === 'success' ? 'default' :
                    testResults[testName] === 'error' ? 'destructive' :
                    testResults[testName] === 'pending' ? 'secondary' : 'outline'
                  }>
                    {testResults[testName] || 'não executado'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Informações Gerais</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Status:</strong> 
                    <Badge className="ml-2" variant={systemHealth.status === 'ok' ? 'default' : 'destructive'}>
                      {systemHealth.status}
                    </Badge>
                  </p>
                  <p><strong>Uptime:</strong> {formatUptime(systemHealth.uptime)}</p>
                  <p><strong>Ambiente:</strong> {systemHealth.config.environment}</p>
                  <p><strong>Versão:</strong> {systemHealth.config.version}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Serviços</h4>
                <div className="space-y-1">
                  {Object.entries(systemHealth.services).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{service}:</span>
                      {status ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <h4 className="font-semibold mb-2">Memória</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>RSS: {formatMemory(systemHealth.memory.rss)}</span>
                    <span>Heap Total: {formatMemory(systemHealth.memory.heapTotal)}</span>
                    <span>Heap Used: {formatMemory(systemHealth.memory.heapUsed)}</span>
                  </div>
                  <Progress 
                    value={(systemHealth.memory.heapUsed / systemHealth.memory.heapTotal) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Stats */}
      {connectionStats && (
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas de Conexão WebSocket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{connectionStats.totalConnections}</div>
                <div className="text-sm text-gray-600">Conexões Totais</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{connectionStats.authenticatedUsers}</div>
                <div className="text-sm text-gray-600">Usuários Autenticados</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.keys(connectionStats.roomDistribution).length}
                </div>
                <div className="text-sm text-gray-600">Salas Ativas</div>
              </div>
            </div>

            {Object.keys(connectionStats.roomDistribution).length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Distribuição por Sala</h4>
                <div className="space-y-2">
                  {Object.entries(connectionStats.roomDistribution).map(([room, count]) => (
                    <div key={room} className="flex justify-between items-center">
                      <span className="text-sm">{room}</span>
                      <Badge variant="outline">{count} conexões</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Test Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs dos Testes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 italic">Nenhum log disponível. Execute os testes para ver os resultados.</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-xs font-mono text-gray-700">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};