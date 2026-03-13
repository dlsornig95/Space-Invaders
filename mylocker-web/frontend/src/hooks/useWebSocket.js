import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/status';

export function useWebSocket() {
  const [nodes, setNodes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'initial_status' || data.type === 'status_update') {
          setNodes(data.nodes || []);
          setPackages(data.packages || []);
          setNetworks(data.networks || []);
          if (data.available_networks) {
            setAvailableNetworks(data.available_networks);
          }
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const subscribeToNetwork = useCallback((network) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        network: network
      }));
      setSelectedNetwork(network);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return {
    nodes,
    packages,
    networks,
    availableNetworks,
    connected,
    error,
    selectedNetwork,
    subscribeToNetwork,
  };
}

export async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  return res.json();
}

// Node control functions
export const startNode = (nodeId, zone = null) =>
  apiCall(`/api/conveyors/${nodeId}/start`, 'POST', zone ? { zone } : {});

export const stopNode = (nodeId, zone = null) =>
  apiCall(`/api/conveyors/${nodeId}/stop`, 'POST', zone ? { zone } : {});

export const jogNode = (nodeId, direction) =>
  apiCall(`/api/conveyors/${nodeId}/jog`, 'POST', { direction });

// Legacy aliases for compatibility
export const startConveyor = startNode;
export const stopConveyor = stopNode;
export const jogConveyor = jogNode;
