import { useEffect, useState, useCallback } from 'react';
import { socketService } from '@/services/socket';

/**
 * Hook personalizado para manejar la conexión Socket.IO
 * Proporciona estado de conexión y métodos para interactuar con el socket
 */

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState({
    id: undefined as string | undefined,
    reconnectAttempts: 0
  });

  // Conectar al socket cuando el hook se monta
  useEffect(() => {
    socketService.connect();
    
    // Listeners para cambios de estado de conexión
    const handleConnected = () => {
      setIsConnected(true);
      setConnectionInfo(socketService.getConnectionInfo());
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setConnectionInfo(socketService.getConnectionInfo());
    };

    const handleConnectionFailed = () => {
      setIsConnected(false);
      setConnectionInfo(socketService.getConnectionInfo());
    };

    // Registrar listeners
    socketService.on('connected', handleConnected);
    socketService.on('disconnected', handleDisconnected);
    socketService.on('connection_failed', handleConnectionFailed);

    // Limpiar listeners al desmontar
    return () => {
      socketService.off('connected', handleConnected);
      socketService.off('disconnected', handleDisconnected);
      socketService.off('connection_failed', handleConnectionFailed);
      socketService.disconnect();
    };
  }, []);

  // Actualizar información de conexión periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      setConnectionInfo(socketService.getConnectionInfo());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Métodos para interactuar con el socket
  const joinRoom = useCallback((room: string) => {
    socketService.joinRoom(room);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketService.leaveRoom(room);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketService.emit(event, data);
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    socketService.on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: Function) => {
    socketService.off(event, callback);
  }, []);

  const reconnect = useCallback(() => {
    socketService.reconnect();
  }, []);

  return {
    socket: socketService,
    isConnected,
    connectionInfo,
    joinRoom,
    leaveRoom,
    emit,
    on,
    off,
    reconnect
  };
}
