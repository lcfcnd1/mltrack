import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import type { SocketEvents } from '@/types';

/**
 * Servicio de Socket.IO para comunicación en tiempo real
 * Maneja la conexión, reconexión y eventos del servidor
 */

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1 segundo inicial
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Conecta al servidor Socket.IO
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const serverUrl = import.meta.env.VITE_SOCKET_URL || '';
    
    this.socket = io(serverUrl, {
      path: '/mltrack/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      maxReconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupSocketListeners();
  }

  /**
   * Desconecta del servidor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Configura los listeners básicos del socket
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Conexión exitosa
    this.socket.on('connect', () => {
      console.log('🔌 Conectado al servidor Socket.IO');
      this.reconnectAttempts = 0;
      
      // Unirse a sala general de notificaciones
      this.socket?.emit('join-room', 'notifications');
      
      // Emitir evento personalizado
      this.emit('connected');
    });

    // Desconexión
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Desconectado del servidor:', reason);
      this.emit('disconnected', reason);
    });

    // Error de conexión
    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket.IO:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error('No se pudo conectar al servidor en tiempo real');
        this.emit('connection_failed', error);
      }
    });

    // Eventos específicos de la aplicación
    this.socket.on('sync:started', (data) => {
      console.log('🔄 Sincronización iniciada:', data);
      toast.loading(`Sincronización ${data.type} iniciada...`, {
        id: `sync-${data.type}-${data.id}`
      });
      this.emit('sync:started', data);
    });

    this.socket.on('sync:progress', (data) => {
      console.log('📊 Progreso de sincronización:', data);
      this.emit('sync:progress', data);
    });

    this.socket.on('sync:completed', (data) => {
      console.log('✅ Sincronización completada:', data);
      toast.dismiss(`sync-${data.result.type}-${data.result.sellerId || data.result.searchId}`);
      toast.success(`Sincronización completada: ${data.result.newItems} nuevos, ${data.result.updatedItems} actualizados`);
      this.emit('sync:completed', data);
    });

    this.socket.on('sync:failed', (data) => {
      console.error('❌ Sincronización falló:', data);
      toast.error(`Error en sincronización: ${data.error}`);
      this.emit('sync:failed', data);
    });

    this.socket.on('scheduler:started', () => {
      console.log('🚀 Scheduler iniciado');
      toast.success('Scheduler de sincronización iniciado');
      this.emit('scheduler:started');
    });

    this.socket.on('scheduler:stopped', () => {
      console.log('⏹️ Scheduler detenido');
      toast.info('Scheduler de sincronización detenido');
      this.emit('scheduler:stopped');
    });

    this.socket.on('notification', (data) => {
      console.log('📢 Notificación recibida:', data);
      
      switch (data.type) {
        case 'info':
          toast(data.message, { icon: 'ℹ️' });
          break;
        case 'success':
          toast.success(data.message);
          break;
        case 'warning':
          toast(data.message, { icon: '⚠️' });
          break;
        case 'error':
          toast.error(data.message);
          break;
      }
      
      this.emit('notification', data);
    });
  }

  /**
   * Configura listeners para eventos personalizados
   */
  private setupEventListeners(): void {
    // Listener para cambios de visibilidad de la página
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.socket?.disconnected) {
        console.log('🔄 Página visible, reconectando...');
        this.connect();
      }
    });

    // Listener para conexión/desconexión de red
    window.addEventListener('online', () => {
      console.log('🌐 Conexión a internet restaurada');
      if (!this.isConnected()) {
        this.connect();
      }
    });

    window.addEventListener('offline', () => {
      console.log('🌐 Conexión a internet perdida');
      this.emit('offline');
    });
  }

  /**
   * Se une a una sala específica
   */
  joinRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-room', room);
      console.log(`📢 Unido a sala: ${room}`);
    }
  }

  /**
   * Sale de una sala específica
   */
  leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', room);
      console.log(`📢 Salido de sala: ${room}`);
    }
  }

  /**
   * Emite un evento al servidor
   */
  emit<K extends keyof SocketEvents>(event: K, data?: Parameters<SocketEvents[K]>[0]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`⚠️ No se pudo emitir evento ${event}: socket no conectado`);
    }
  }

  /**
   * Escucha un evento del servidor
   */
  on<K extends keyof SocketEvents>(
    event: K,
    callback: SocketEvents[K]
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Deja de escuchar un evento
   */
  off<K extends keyof SocketEvents>(
    event: K,
    callback?: SocketEvents[K]
  ): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }

    if (this.listeners.has(event)) {
      if (callback) {
        const callbacks = this.listeners.get(event)!;
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      } else {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emite un evento personalizado localmente
   */
  private emit(event: string, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en listener de evento ${event}:`, error);
        }
      });
    }
  }

  /**
   * Obtiene información de conexión
   */
  getConnectionInfo(): {
    connected: boolean;
    id: string | undefined;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      id: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Fuerza una reconexión
   */
  reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }
}

// Instancia singleton del servicio de socket
export const socketService = new SocketService();

// Hook para usar el servicio de socket en componentes React
export function useSocket() {
  return {
    socket: socketService,
    isConnected: socketService.isConnected(),
    connect: () => socketService.connect(),
    disconnect: () => socketService.disconnect(),
    joinRoom: (room: string) => socketService.joinRoom(room),
    leaveRoom: (room: string) => socketService.leaveRoom(room),
    emit: (event: string, data?: any) => socketService.emit(event, data),
    on: (event: string, callback: Function) => socketService.on(event, callback),
    off: (event: string, callback?: Function) => socketService.off(event, callback),
  };
}
