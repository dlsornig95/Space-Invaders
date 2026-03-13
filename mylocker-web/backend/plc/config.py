"""MCP3 PLC Configuration - MyLocker T-Shirt Factory Conveyor System"""

import random

import os

# Set to True for development without actual PLC connection
# Can be overridden by MOCK_MODE environment variable
MOCK_MODE = os.environ.get("MOCK_MODE", "true").lower() == "true"

PLC_CONFIG = {
    "ip": os.environ.get("PLC_IP", "192.168.5.58"),
    "slot": int(os.environ.get("PLC_SLOT", "0")),
    "timeout": 5.0,
}

# Network definitions from MCP3 L5K file
# Each network has Node_AB or Enet_Turck/Node_Turck nodes
# Configure via NETWORKS env var: "DN1,DN2,EN3,DN4,DN5" or subset
_enabled_networks = os.environ.get("NETWORKS", "DN1,DN2,EN3,DN4,DN5").split(",")

_ALL_NETWORKS = {
    "DN1": {"type": "DeviceNet", "nodes": list(range(1, 45))},   # DN1_01 - DN1_44
    "DN2": {"type": "DeviceNet", "nodes": list(range(1, 57))},   # DN2_01 - DN2_56
    "EN3": {"type": "EtherNet/IP", "nodes": list(range(1, 115))}, # EN3_01 - EN3_114
    "DN4": {"type": "DeviceNet", "nodes": list(range(1, 57))},   # DN4_01 - DN4_56
    "DN5": {"type": "DeviceNet", "nodes": list(range(1, 45))},   # DN5_01 - DN5_44
}

NETWORKS = {k: v for k, v in _ALL_NETWORKS.items() if k in _enabled_networks}

# Tag structure for Node_AB / Node_Turck / Enet_Turck (from L5K analysis)
# Each node has 8 zones (bits 1-8 of the Data words)
NODE_TAG_STRUCTURE = {
    # Input tags
    "part_present": "{node}.I.Data",         # INT - bits 1-8 are zone part present
    "zone_running": "{node}.I.OutputStatus", # INT - bits 1-8 are zone running status
    "devicelogix_enabled": "{node}.I.Data.14",  # BIT - DeviceLogix Enabled
    "aux_power_fault": "{node}.I.Data.15",      # BIT - Aux Power Fault (Node_AB)
    # Output tags
    "zone_command": "{node}.O.Data",         # INT - bits 1-8 are zone turn-on commands
    "power_light": "{node}.O.Data.0",        # BIT - Turn Power Light On
    # Control tags
    "pushbutton": "{node}.PB",               # DINT - pushbutton bits
    "manual": "{node}.Manual",               # DINT - manual control bits
}

# Node_Turck specific fault bits (different structure)
NODE_TURCK_FAULT_TAGS = {
    "output_group_fault": "{node}.I.OGS",    # BIT - Output Group Fault
    "input_group_fault": "{node}.I.IGS",     # BIT - Input Group Fault
}

# Node_Turck nodes - these do NOT have I.OutputStatus tag
# They only have I.Data for input, no running status feedback
NODE_TURCK_NODES = {
    "DN1": [18, 38, 39, 42, 43],
    "DN2": [],
    "EN3": [],
    "DN4": [],
    "DN5": [],
}

def is_node_turck(node_name: str) -> bool:
    """Check if a node is a Node_Turck (no OutputStatus tag)"""
    for network, nodes in NODE_TURCK_NODES.items():
        if node_name.startswith(network + "_"):
            try:
                node_num = int(node_name.split("_")[1])
                return node_num in nodes
            except (IndexError, ValueError):
                pass
    return False

ZONES_PER_NODE = 8  # Each node controls zones 1-8

def get_node_name(network: str, node_num: int) -> str:
    """Generate node tag name like DN1_01, EN3_05"""
    return f"{network}_{node_num:02d}"

def get_all_nodes() -> list:
    """Get list of all node identifiers"""
    nodes = []
    for network, config in NETWORKS.items():
        for node_num in config["nodes"]:
            nodes.append({
                "network": network,
                "node_num": node_num,
                "name": get_node_name(network, node_num),
                "type": config["type"],
            })
    return nodes

# Generate conveyor list (each node + zone combo is a conveyor segment)
def generate_conveyor_list():
    """Generate full conveyor list from network/node/zone structure"""
    conveyors = []
    conv_id = 1
    for node in get_all_nodes():
        for zone in range(1, ZONES_PER_NODE + 1):
            conveyors.append({
                "id": conv_id,
                "network": node["network"],
                "node": node["name"],
                "node_num": node["node_num"],
                "zone": zone,
                "name": f"{node['name']} Z{zone}",
                "display_name": f"{node['name']} Zone {zone}",
                "tags": {
                    "part_present": f"{node['name']}.I.Data.{zone}",
                    "running": f"{node['name']}.I.OutputStatus.{zone}",
                    "command": f"{node['name']}.O.Data.{zone}",
                }
            })
            conv_id += 1
    return conveyors

CONVEYOR_LIST = generate_conveyor_list()

# For simpler node-level view (not zone-level)
def generate_node_list():
    """Generate node-level conveyor list"""
    nodes = []
    for node in get_all_nodes():
        nodes.append({
            "id": node["name"],
            "network": node["network"],
            "node_num": node["node_num"],
            "name": node["name"],
            "type": node["type"],
            "zones": ZONES_PER_NODE,
        })
    return nodes

NODE_LIST = generate_node_list()

# Elevator configuration
ELEVATORS = ["A", "B", "C"]

# Mock data generator
def generate_mock_data():
    """Generate realistic mock data for the conveyor system"""
    mock_nodes = {}

    for node in NODE_LIST:
        # Random but consistent status per node
        seed = hash(node["name"]) % 100
        random.seed(seed)

        # Node-level fault from I.Data.15 (Aux Power Fault)
        # This affects the entire node, not individual zones
        aux_power_fault = random.random() > 0.95  # 5% have aux power fault

        # Generate zone statuses (8 zones per node)
        # Zone faults inherit from node-level aux_power_fault
        zones = {}
        for z in range(1, ZONES_PER_NODE + 1):
            zones[z] = {
                "part_present": random.random() > 0.7,  # 30% have product
                "running": random.random() > 0.15 if not aux_power_fault else False,
                "fault": aux_power_fault,  # Zone fault = node aux power fault
            }

        mock_nodes[node["name"]] = {
            "id": node["name"],
            "name": node["name"],
            "network": node["network"],
            "type": node["type"],
            "zones": zones,
            "online": random.random() > 0.02,  # 98% online
            "aux_power_fault": aux_power_fault,  # From {node}.I.Data.15
            "devicelogix_enabled": random.random() > 0.05,  # From {node}.I.Data.14
        }

    # Generate some packages in transit
    mock_packages = {}
    random.seed(42)
    active_nodes = [n["name"] for n in NODE_LIST if random.random() > 0.8][:25]

    for i, node_name in enumerate(active_nodes, 1):
        dest_idx = (i + 5) % len(active_nodes)
        mock_packages[i] = {
            "id": i,
            "location": node_name,
            "destination": active_nodes[dest_idx],
            "status": 1 if i % 3 != 0 else 2,  # Moving or arrived
        }

    return {
        "nodes": mock_nodes,
        "packages": mock_packages,
    }

MOCK_DATA = generate_mock_data()

# Summary stats
print(f"MCP3 Config loaded: {len(NODE_LIST)} nodes, {len(CONVEYOR_LIST)} zone segments")
