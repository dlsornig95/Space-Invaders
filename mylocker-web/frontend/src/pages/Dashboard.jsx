import { useState } from 'react';
import { useWebSocket, startNode, stopNode } from '../hooks/useWebSocket';

export default function Dashboard() {
  const { nodes, packages, networks, availableNetworks, connected, subscribeToNetwork } = useWebSocket();
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState('');

  const filteredNodes = nodes.filter(n => {
    const matchesSearch = n.name.toLowerCase().includes(search.toLowerCase());
    const matchesNetwork = !networkFilter || n.network === networkFilter;
    return matchesSearch && matchesNetwork;
  });

  const getStatusColor = (node) => {
    if (!node.online) return 'bg-gray-500';
    if (node.fault) return 'bg-yellow-500';
    if (node.running) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = (node) => {
    if (!node.online) return 'Offline';
    if (node.fault) return 'FAULT';
    if (node.running) return 'Running';
    return 'Stopped';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MCP3 Dashboard</h1>
        <span className={`px-3 py-1 rounded text-sm ${connected ? 'bg-green-600' : 'bg-red-600'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Network Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        {networks.map(net => (
          <div
            key={net.network}
            onClick={() => {
              setNetworkFilter(networkFilter === net.network ? '' : net.network);
              subscribeToNetwork(networkFilter === net.network ? null : net.network);
            }}
            className={`p-4 rounded-lg cursor-pointer transition-colors ${
              networkFilter === net.network ? 'bg-blue-700 ring-2 ring-blue-400' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <h3 className="font-bold text-lg">{net.network}</h3>
            <p className="text-xs text-gray-400">{net.type}</p>
            <div className="mt-2 text-sm">
              <span className="text-green-400">{net.running_count}</span>
              <span className="text-gray-500"> / {net.node_count} running</span>
            </div>
            {net.fault_count > 0 && (
              <div className="text-yellow-400 text-sm">{net.fault_count} faults</div>
            )}
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2 bg-gray-800 rounded border border-gray-700"
        />
        <select
          value={networkFilter}
          onChange={(e) => {
            setNetworkFilter(e.target.value);
            subscribeToNetwork(e.target.value || null);
          }}
          className="p-2 bg-gray-800 rounded border border-gray-700"
        >
          <option value="">All Networks</option>
          {availableNetworks.map(net => (
            <option key={net} value={net}>{net}</option>
          ))}
        </select>
      </div>

      {/* Node Count */}
      <p className="text-sm text-gray-400 mb-4">
        Showing {filteredNodes.length} of {nodes.length} nodes
      </p>

      {/* Node Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredNodes.map(node => (
          <div key={node.id} className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{node.name}</span>
              <span className={`w-3 h-3 rounded-full ${getStatusColor(node)}`} />
            </div>
            <div className="text-xs text-gray-500 mb-1">{node.network} - {node.type}</div>
            <div className="text-sm text-gray-400 mb-3">
              {getStatusText(node)}
              {node.has_product && <span className="ml-2 text-blue-400">● Product</span>}
            </div>

            {/* Zone indicators */}
            <div className="flex gap-1 mb-3">
              {Object.entries(node.zones || {}).map(([zoneNum, zone]) => (
                <div
                  key={zoneNum}
                  className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                    zone.fault ? 'bg-yellow-600' :
                    zone.running ? 'bg-green-600' : 'bg-gray-600'
                  } ${zone.part_present ? 'ring-2 ring-blue-400' : ''}`}
                  title={`Zone ${zoneNum}: ${zone.running ? 'Running' : 'Stopped'}${zone.part_present ? ', Product' : ''}`}
                >
                  {zoneNum}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => startNode(node.id)}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
              >
                Start
              </button>
              <button
                onClick={() => stopNode(node.id)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Stop
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Packages Section */}
      <h2 className="text-xl font-bold mt-8 mb-4">Packages ({packages.length})</h2>
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Location</th>
              <th className="p-3 text-left">Destination</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.map(p => (
              <tr key={p.id} className="border-t border-gray-700">
                <td className="p-3">PKG-{p.id}</td>
                <td className="p-3">{p.location}</td>
                <td className="p-3">{p.destination}</td>
                <td className="p-3">{p.status === 1 ? 'Moving' : 'Arrived'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
