import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IntegrationService } from './integration.service';
import { integrationConfig } from '../../core/config/integration.config';

interface ConnectedClient {
  id: string;
  userId?: number;
  rooms: Set<string>;
  lastActivity: Date;
}

@WebSocketGateway({
  cors: {
    origin: integrationConfig.cors.allowedOrigins,
    credentials: true,
  },
  namespace: '/realtime',
})
export class IntegrationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;
  
  private readonly logger = new Logger(IntegrationGateway.name);
  private readonly connectedClients = new Map<string, ConnectedClient>();
  private readonly userSockets = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly integrationService: IntegrationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
    
    // Setup periodic cleanup of inactive connections
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 5 * 60 * 1000); // 5 minutes

    // Setup periodic dashboard updates
    setInterval(() => {
      this.broadcastDashboardUpdate();
    }, 30000); // 30 seconds
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (${client.id})`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      let userId: number | undefined;
      try {
        const payload = this.jwtService.verify(token);
        userId = payload.sub;
      } catch (error) {
        this.logger.warn(`Connection rejected: Invalid token (${client.id})`);
        client.disconnect();
        return;
      }

      // Store client connection
      const clientInfo: ConnectedClient = {
        id: client.id,
        userId,
        rooms: new Set(['dashboard']), // default room
        lastActivity: new Date(),
      };

      this.connectedClients.set(client.id, clientInfo);

      if (userId) {
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(client.id);
      }

      // Join default room
      client.join('dashboard');
      
      this.logger.log(`Client connected: ${client.id} (userId: ${userId})`);

      // Send initial dashboard data
      const dashboardStats = await this.integrationService.getDashboardStats();
      const recentActivities = await this.integrationService.getRecentActivities(10);
      
      client.emit('dashboard:stats', dashboardStats);
      client.emit('dashboard:activities', recentActivities);

      // Notify other clients about new connection
      client.to('dashboard').emit('user:connected', {
        userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const clientInfo = this.connectedClients.get(client.id);
    
    if (clientInfo) {
      // Remove from user sockets map
      if (clientInfo.userId) {
        const userSockets = this.userSockets.get(clientInfo.userId);
        if (userSockets) {
          userSockets.delete(client.id);
          if (userSockets.size === 0) {
            this.userSockets.delete(clientInfo.userId);
          }
        }

        // Notify other clients about disconnection
        client.to('dashboard').emit('user:disconnected', {
          userId: clientInfo.userId,
          timestamp: new Date().toISOString(),
        });
      }

      this.connectedClients.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id} (userId: ${clientInfo.userId})`);
    }
  }

  // Subscribe to dashboard updates
  @SubscribeMessage('dashboard:subscribe')
  async handleDashboardSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { refresh?: boolean },
  ): Promise<void> {
    try {
      const clientInfo = this.connectedClients.get(client.id);
      if (!clientInfo) return;

      clientInfo.lastActivity = new Date();
      clientInfo.rooms.add('dashboard');
      client.join('dashboard');

      if (data?.refresh) {
        const [dashboardStats, recentActivities] = await Promise.all([
          this.integrationService.getDashboardStats(),
          this.integrationService.getRecentActivities(10),
        ]);

        client.emit('dashboard:stats', dashboardStats);
        client.emit('dashboard:activities', recentActivities);
      }

      this.logger.debug(`Client ${client.id} subscribed to dashboard updates`);
    } catch (error) {
      this.logger.error(`Error in dashboard subscribe for client ${client.id}:`, error);
      client.emit('error', { message: 'Failed to subscribe to dashboard updates' });
    }
  }

  // Subscribe to document processing updates
  @SubscribeMessage('documents:subscribe')
  async handleDocumentsSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { documentIds?: number[] },
  ): Promise<void> {
    try {
      const clientInfo = this.connectedClients.get(client.id);
      if (!clientInfo) return;

      clientInfo.lastActivity = new Date();

      if (data?.documentIds?.length) {
        // Subscribe to specific documents
        data.documentIds.forEach(id => {
          const room = `document:${id}`;
          clientInfo.rooms.add(room);
          client.join(room);
        });
        
        this.logger.debug(`Client ${client.id} subscribed to documents: ${data.documentIds.join(', ')}`);
      } else {
        // Subscribe to all documents
        const room = 'documents';
        clientInfo.rooms.add(room);
        client.join(room);
        
        this.logger.debug(`Client ${client.id} subscribed to all document updates`);
      }
    } catch (error) {
      this.logger.error(`Error in documents subscribe for client ${client.id}:`, error);
      client.emit('error', { message: 'Failed to subscribe to document updates' });
    }
  }

  // Unsubscribe from updates
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ): Promise<void> {
    try {
      const clientInfo = this.connectedClients.get(client.id);
      if (!clientInfo) return;

      clientInfo.lastActivity = new Date();
      clientInfo.rooms.delete(data.room);
      client.leave(data.room);

      this.logger.debug(`Client ${client.id} unsubscribed from ${data.room}`);
    } catch (error) {
      this.logger.error(`Error in unsubscribe for client ${client.id}:`, error);
    }
  }

  // Ping/Pong for connection health
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  // Public methods for broadcasting events
  
  // Broadcast dashboard update to all connected clients
  async broadcastDashboardUpdate(): Promise<void> {
    try {
      if (this.connectedClients.size === 0) return;

      const dashboardStats = await this.integrationService.getDashboardStats();
      this.server.to('dashboard').emit('dashboard:stats', dashboardStats);
      
      this.logger.debug('Dashboard stats broadcasted to all clients');
    } catch (error) {
      this.logger.error('Error broadcasting dashboard update:', error);
    }
  }

  // Broadcast new activity
  broadcastActivity(activity: any): void {
    this.server.to('dashboard').emit('dashboard:activity', activity);
    this.logger.debug('New activity broadcasted:', activity);
  }

  // Broadcast document processing update
  broadcastDocumentUpdate(documentId: number, update: any): void {
    const room = `document:${documentId}`;
    this.server.to(room).emit('document:update', {
      documentId,
      ...update,
      timestamp: new Date().toISOString(),
    });
    
    // Also broadcast to general documents room
    this.server.to('documents').emit('document:update', {
      documentId,
      ...update,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Document update broadcasted for document ${documentId}:`, update);
  }

  // Broadcast system notification
  broadcastSystemNotification(notification: {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    userId?: number;
  }): void {
    if (notification.userId) {
      // Send to specific user
      const userSockets = this.userSockets.get(notification.userId);
      if (userSockets) {
        userSockets.forEach(socketId => {
          this.server.to(socketId).emit('notification', {
            ...notification,
            timestamp: new Date().toISOString(),
          });
        });
      }
    } else {
      // Broadcast to all users
      this.server.emit('notification', {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.debug('System notification broadcasted:', notification);
  }

  // Get connection statistics
  getConnectionStats(): any {
    const stats = {
      totalConnections: this.connectedClients.size,
      authenticatedUsers: this.userSockets.size,
      roomDistribution: {} as Record<string, number>,
    };

    // Calculate room distribution
    this.connectedClients.forEach(client => {
      client.rooms.forEach(room => {
        stats.roomDistribution[room] = (stats.roomDistribution[room] || 0) + 1;
      });
    });

    return stats;
  }

  // Private helper methods

  private cleanupInactiveConnections(): void {
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
    const now = new Date();

    for (const [clientId, clientInfo] of this.connectedClients) {
      if (now.getTime() - clientInfo.lastActivity.getTime() > inactiveThreshold) {
        this.logger.warn(`Disconnecting inactive client: ${clientId}`);
        const socket = this.server.sockets.sockets.get(clientId);
        if (socket) {
          socket.disconnect();
        }
      }
    }
  }
}