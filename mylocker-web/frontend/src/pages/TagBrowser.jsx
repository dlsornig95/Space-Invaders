import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TagBrowser() {
  const [status, setStatus] = useState({ connected: false, mock_mode: true });
  const [nodes, setNodes] = useState({});
  const [selectedNetwork, setSelectedNetwork] = useState('DN1');
  const [selectedNode, setSelectedNode] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [readResults, setReadResults] = useState([]);
  const [writeTag, setWriteTag] = useState('');
  const [writeValue, setWriteValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch connection status and nodes on mount
  useEffect(() => {
    fetchStatus();
    fetchNodes();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tags/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setError('Failed to fetch status');
    }
  };

  const fetchNodes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tags/nodes`);
      const data = await res.json();
      setNodes(data);
    } catch (e) {
      setError('Failed to fetch nodes');
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tags/connect`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      }
    } catch (e) {
      setError('Failed to connect');
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    try {
      await fetch(`${API_BASE}/api/tags/disconnect`, { method: 'POST' });
      fetchStatus();
    } catch (e) {
      setError('Failed to disconnect');
    }
  };

  const handleReadTags = async () => {
    if (!tagInput.trim()) return;

    setLoading(true);
    setError('');
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
      const res = await fetch(`${API_BASE}/api/tags/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      const data = await res.json();

      if (data.success) {
        const results = Object.entries(data.results).map(([tag, value]) => ({
          tag,
          value,
          timestamp: new Date().toLocaleTimeString(),
          mock: data.mock,
        }));
        setReadResults(prev => [...results, ...prev].slice(0, 50));
      }
    } catch (e) {
      setError('Failed to read tags');
    }
    setLoading(false);
  };

  const handleWriteTag = async () => {
    if (!writeTag.trim()) return;

    setLoading(true);
    setError('');
    try {
      let value = writeValue;
      // Parse value type
      if (writeValue === 'true') value = true;
      else if (writeValue === 'false') value = false;
      else if (!isNaN(writeValue)) value = Number(writeValue);

      const res = await fetch(`${API_BASE}/api/tags/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: writeTag, value }),
      });
      const data = await res.json();

      if (data.success) {
        setReadResults(prev => [{
          tag: writeTag,
          value: `WRITE: ${value}`,
          timestamp: new Date().toLocaleTimeString(),
          mock: data.mock,
          isWrite: true,
        }, ...prev].slice(0, 50));
      }
    } catch (e) {
      setError('Failed to write tag');
    }
    setLoading(false);
  };

  const handleQuickRead = (node) => {
    const tags = [
      `${node}.I.Data`,
      `${node}.I.OutputStatus`,
    ];
    setTagInput(tags.join(', '));
  };

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return `${value} (0x${value.toString(16).toUpperCase()}) (0b${value.toString(2).padStart(16, '0')})`;
    }
    return String(value);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">PLC Tag Browser</h1>

      {/* Connection Status */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold mb-2">Connection Status</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className={status.connected ? 'text-green-400' : 'text-red-400'}>
                {status.connected ? 'Connected' : 'Disconnected'}
              </span>
              {status.mock_mode && (
                <span className="text-yellow-400 bg-yellow-900 px-2 py-1 rounded">
                  MOCK MODE
                </span>
              )}
              {!status.mock_mode && (
                <span className="text-gray-400">PLC: {status.plc_ip}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded"
            >
              Connect
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 text-red-200 p-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node Browser */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="font-bold mb-4">Node Browser</h2>

          <div className="flex gap-2 mb-4">
            {Object.keys(nodes).map(net => (
              <button
                key={net}
                onClick={() => {
                  setSelectedNetwork(net);
                  setSelectedNode('');
                }}
                className={`px-3 py-1 rounded text-sm ${
                  selectedNetwork === net
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {net}
              </button>
            ))}
          </div>

          <div className="h-64 overflow-y-auto bg-gray-900 rounded p-2">
            <div className="grid grid-cols-4 gap-1">
              {(nodes[selectedNetwork] || []).map(node => (
                <button
                  key={node}
                  onClick={() => {
                    setSelectedNode(node);
                    handleQuickRead(node);
                  }}
                  className={`px-2 py-1 rounded text-xs ${
                    selectedNode === node
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {node.replace(`${selectedNetwork}_`, '')}
                </button>
              ))}
            </div>
          </div>

          {selectedNode && (
            <div className="mt-4 p-3 bg-gray-900 rounded">
              <p className="font-bold mb-2">{selectedNode}</p>
              <div className="text-xs text-gray-400 space-y-1">
                <p><code>{selectedNode}.I.Data</code> - Input (part present, fault)</p>
                <p><code>{selectedNode}.I.OutputStatus</code> - Zone running status</p>
                <p><code>{selectedNode}.O.Data</code> - Output commands</p>
                <p><code>{selectedNode}.I.Data.15</code> - Aux Power Fault</p>
              </div>
            </div>
          )}
        </div>

        {/* Read/Write Panel */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="font-bold mb-4">Read Tags</h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="DN1_17.I.Data, DN1_17.I.OutputStatus"
              className="flex-1 p-2 bg-gray-900 rounded border border-gray-700 text-sm"
            />
            <button
              onClick={handleReadTags}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
            >
              Read
            </button>
          </div>

          <h2 className="font-bold mb-4 mt-6">Write Tag</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={writeTag}
              onChange={(e) => setWriteTag(e.target.value)}
              placeholder="DN1_17.O.Data.1"
              className="flex-1 p-2 bg-gray-900 rounded border border-gray-700 text-sm"
            />
            <input
              type="text"
              value={writeValue}
              onChange={(e) => setWriteValue(e.target.value)}
              placeholder="true/false/number"
              className="w-32 p-2 bg-gray-900 rounded border border-gray-700 text-sm"
            />
            <button
              onClick={handleWriteTag}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded"
            >
              Write
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Values: true, false, or integer (e.g., 255 for all zones on)
          </p>
        </div>
      </div>

      {/* Results Log */}
      <div className="mt-6 bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold">Results Log</h2>
          <button
            onClick={() => setReadResults([])}
            className="text-sm text-gray-400 hover:text-white"
          >
            Clear
          </button>
        </div>

        <div className="h-64 overflow-y-auto bg-gray-900 rounded p-2 font-mono text-sm">
          {readResults.length === 0 ? (
            <p className="text-gray-500">No results yet. Select a node or enter tags to read.</p>
          ) : (
            readResults.map((result, i) => (
              <div
                key={i}
                className={`py-1 border-b border-gray-800 ${
                  result.isWrite ? 'text-orange-400' : 'text-green-400'
                }`}
              >
                <span className="text-gray-500">[{result.timestamp}]</span>
                {result.mock && <span className="text-yellow-500 ml-2">[MOCK]</span>}
                <span className="text-blue-400 ml-2">{result.tag}</span>
                <span className="text-gray-400 ml-2">=</span>
                <span className="ml-2">{formatValue(result.value)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tag Reference */}
      <div className="mt-6 bg-gray-800 p-4 rounded-lg">
        <h2 className="font-bold mb-4">Tag Reference (from L5K)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-bold text-blue-400 mb-2">Input Tags ({'{node}'}.I.*)</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.I.Data</code></td>
                  <td className="text-gray-400">Input word (INT)</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.I.Data.1-8</code></td>
                  <td className="text-gray-400">Zone 1-8 Part Present</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.I.Data.14</code></td>
                  <td className="text-gray-400">DeviceLogix Enabled</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.I.Data.15</code></td>
                  <td className="text-yellow-400">Aux Power Fault</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.I.OutputStatus</code></td>
                  <td className="text-gray-400">Zone running status (bits 1-8)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="font-bold text-orange-400 mb-2">Output Tags ({'{node}'}.O.*)</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.O.Data</code></td>
                  <td className="text-gray-400">Output word (INT)</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.O.Data.0</code></td>
                  <td className="text-gray-400">Power Light On</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-1"><code>.O.Data.1-8</code></td>
                  <td className="text-gray-400">Turn On Zone 1-8</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
