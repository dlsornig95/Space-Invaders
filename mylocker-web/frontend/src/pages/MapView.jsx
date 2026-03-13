import { useState, Fragment, useMemo } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import { useWebSocket, startNode, stopNode, jogNode } from '../hooks/useWebSocket';
import dn1Layout from '../dn1-layout.json';

export default function MapView() {
  const { nodes, networks, availableNetworks, connected, subscribeToNetwork } = useWebSocket();
  const [selected, setSelected] = useState(null);
  const [networkFilter, setNetworkFilter] = useState('DN1');

  const filteredNodes = nodes.filter(n => n.network === networkFilter);

  const getNodeColor = (node) => {
    if (!node) return '#22c55e';
    if (!node.online) return '#6b7280';
    if (node.fault) return '#eab308';
    if (node.running) return '#22c55e';
    return '#ef4444';
  };

  const selectedNode = nodes.find(n => n.id === selected);

  const usesDrawioLayout = networkFilter === 'DN1';

  // Calculate stage size from layout data
  const stageBounds = useMemo(() => {
    if (usesDrawioLayout && dn1Layout.length > 0) {
      const maxX = Math.max(...dn1Layout.map(s => s.x + s.width)) + 50;
      const maxY = Math.max(...dn1Layout.map(s => s.y + s.height)) + 50;
      return { width: maxX, height: maxY };
    }
    return { width: 1200, height: 800 };
  }, [usesDrawioLayout]);

  // Helper to find node data by label (N17 -> DN1_17, 18T -> DN1_18)
  const findNodeByLabel = (label) => {
    if (!label) return null;

    // Match N## or ##T patterns
    const nMatch = label.match(/^N(\d+)$/);
    const tMatch = label.match(/^(\d+)T$/);

    if (nMatch) {
      const nodeId = `DN1_${nMatch[1].padStart(2, '0')}`;
      return nodes.find(n => n.id === nodeId);
    }
    if (tMatch) {
      const nodeId = `DN1_${tMatch[1].padStart(2, '0')}`;
      return nodes.find(n => n.id === nodeId);
    }
    return null;
  };

  // Get the node ID from a label
  const getNodeIdFromLabel = (label) => {
    if (!label) return null;
    const nMatch = label.match(/^N(\d+)$/);
    const tMatch = label.match(/^(\d+)T$/);
    if (nMatch) return `DN1_${nMatch[1].padStart(2, '0')}`;
    if (tMatch) return `DN1_${tMatch[1].padStart(2, '0')}`;
    return null;
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 bg-gray-900 overflow-auto">
        {/* Network tabs */}
        <div className="flex gap-1 p-2 bg-gray-800 flex-wrap sticky top-0 z-10">
          {availableNetworks.map(net => (
            <button
              key={net}
              onClick={() => {
                setNetworkFilter(net);
                setSelected(null);
                subscribeToNetwork(net);
              }}
              className={`px-3 py-1 rounded text-sm ${
                networkFilter === net
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {net}
            </button>
          ))}
        </div>

        <Stage width={stageBounds.width} height={stageBounds.height}>
          <Layer>
            {/* DN1 uses draw.io layout */}
            {usesDrawioLayout && dn1Layout.map((shape, i) => {
              const node = findNodeByLabel(shape.label);
              const nodeId = getNodeIdFromLabel(shape.label);
              const color = node ? getNodeColor(node) : '#22c55e';
              const isSelected = nodeId && selected === nodeId;

              return (
                <Fragment key={i}>
                  <Rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={color}
                    stroke={isSelected ? '#fff' : '#333'}
                    strokeWidth={isSelected ? 2 : 1}
                    cornerRadius={2}
                    onClick={() => nodeId && setSelected(nodeId)}
                    onTap={() => nodeId && setSelected(nodeId)}
                  />
                  {shape.label && (
                    <Text
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      text={shape.label}
                      fill="#000"
                      fontSize={Math.min(12, Math.min(shape.width, shape.height) * 0.4)}
                      fontStyle="bold"
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  )}
                </Fragment>
              );
            })}

            {/* Other networks use grid layout */}
            {!usesDrawioLayout && filteredNodes.map((node, index) => {
              const cols = 10;
              const x = 40 + (index % cols) * 60;
              const y = 60 + Math.floor(index / cols) * 40;

              return (
                <Fragment key={node.id}>
                  <Rect
                    x={x}
                    y={y}
                    width={50}
                    height={24}
                    fill={getNodeColor(node)}
                    stroke={selected === node.id ? '#fff' : '#333'}
                    strokeWidth={selected === node.id ? 2 : 1}
                    cornerRadius={3}
                    onClick={() => setSelected(node.id)}
                    onTap={() => setSelected(node.id)}
                  />
                  <Text
                    x={x + 3}
                    y={y + 6}
                    text={node.name.replace(`${networkFilter}_`, '')}
                    fill="#000"
                    fontSize={11}
                    fontStyle="bold"
                    listening={false}
                  />
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* Control Panel */}
      <div className="w-80 bg-gray-900 p-4 overflow-y-auto border-l border-gray-700">
        <h2 className="text-lg font-bold mb-4">Controls</h2>
        <div className={`mb-4 text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </div>

        {/* Network Summary */}
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <h3 className="font-bold mb-2">{networkFilter} Summary</h3>
          {networks.filter(n => n.network === networkFilter).map(net => (
            <div key={net.network} className="text-sm">
              <div className="text-gray-400">{net.type}</div>
              <div>
                <span className="text-green-400">{net.running_count}</span>
                <span className="text-gray-500"> / {net.node_count} running</span>
              </div>
              {net.fault_count > 0 && (
                <div className="text-yellow-400">{net.fault_count} faults</div>
              )}
            </div>
          ))}
        </div>

        {selectedNode ? (
          <div className="bg-gray-800 p-4 rounded">
            <h3 className="font-bold mb-2">{selectedNode.name}</h3>
            <p className="text-xs text-gray-500 mb-2">{selectedNode.type}</p>
            <p className="text-sm text-gray-400 mb-4">
              {!selectedNode.online ? 'OFFLINE' :
               selectedNode.fault ? 'FAULT' :
               selectedNode.running ? 'Running' : 'Stopped'}
            </p>

            {/* Zone status grid */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Zones:</p>
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(selectedNode.zones || {}).map(([zoneNum, zone]) => (
                  <div
                    key={zoneNum}
                    className={`p-2 rounded text-center text-xs ${
                      zone.fault ? 'bg-yellow-600' :
                      zone.running ? 'bg-green-600' : 'bg-gray-600'
                    } ${zone.part_present ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <div className="font-bold">Z{zoneNum}</div>
                    <div className="text-xs opacity-75">
                      {zone.running ? 'ON' : 'OFF'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => startNode(selected)}
                disabled={!selectedNode.online}
                className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded"
              >
                Start All Zones
              </button>
              <button
                onClick={() => stopNode(selected)}
                disabled={!selectedNode.online}
                className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded"
              >
                Stop All Zones
              </button>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => jogNode(selected, 'reverse')}
                  disabled={!selectedNode.online}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
                >
                  Jog Rev
                </button>
                <button
                  onClick={() => jogNode(selected, 'forward')}
                  disabled={!selectedNode.online}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
                >
                  Jog Fwd
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Click a labeled node to select</p>
        )}

        {/* Legend */}
        <div className="mt-6 p-3 bg-gray-800 rounded">
          <h4 className="font-bold mb-2 text-sm">Legend</h4>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Running</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Stopped</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Fault</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500 rounded"></div>
              <span>Offline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
