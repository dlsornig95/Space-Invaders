"""MCP3 Tag reading and writing utilities for MyLocker conveyor system"""

from typing import Any, Optional
from .connection import plc
from .config import (
    MOCK_MODE, MOCK_DATA, NODE_LIST, NETWORKS,
    ZONES_PER_NODE, get_node_name
)


def read_tag(tag: str) -> Optional[Any]:
    """Read a single tag value"""
    return plc.read(tag)


def write_tag(tag: str, value: Any) -> bool:
    """Write a value to a tag"""
    return plc.write(tag, value)


def read_multiple_tags(tags: list[str]) -> dict[str, Any]:
    """Read multiple tags at once"""
    return plc.read_multiple(tags)


def get_node_status(node_name: str) -> dict:
    """Get full status of a node and all its zones"""
    if MOCK_MODE:
        node_data = MOCK_DATA["nodes"].get(node_name)
        if node_data:
            # Calculate aggregate status
            zones = node_data.get("zones", {})
            any_running = any(z.get("running", False) for z in zones.values())
            any_product = any(z.get("part_present", False) for z in zones.values())
            # Fault comes from node-level aux_power_fault ({node}.I.Data.15)
            aux_power_fault = node_data.get("aux_power_fault", False)

            return {
                "id": node_name,
                "name": node_name,
                "network": node_data.get("network", ""),
                "type": node_data.get("type", ""),
                "online": node_data.get("online", True),
                "running": any_running,
                "fault": aux_power_fault,  # Node-level fault from I.Data.15
                "has_product": any_product,
                "zones": zones,
            }
        return {
            "id": node_name,
            "name": node_name,
            "network": "",
            "type": "",
            "online": False,
            "running": False,
            "fault": False,
            "has_product": False,
            "zones": {},
        }

    # Real PLC read - I.Data contains part present (bits 1-8) and fault (bit 15)
    # Node_Turck nodes don't have I.OutputStatus, only I.Data
    has_output_status = plc.has_output_status(node_name)

    if has_output_status:
        tags = [f"{node_name}.I.Data", f"{node_name}.I.OutputStatus"]
    else:
        tags = [f"{node_name}.I.Data"]

    values = read_multiple_tags(tags)

    input_data_word = values.get(f"{node_name}.I.Data", 0) or 0
    output_status_word = values.get(f"{node_name}.I.OutputStatus", 0) or 0 if has_output_status else 0

    # Bit 15 of I.Data = Aux Power Fault (node-level fault)
    aux_power_fault = bool(input_data_word & (1 << 15))

    zones = {}
    for z in range(1, ZONES_PER_NODE + 1):
        zones[z] = {
            "part_present": bool(input_data_word & (1 << z)),  # Bits 1-8 = zone part present
            "running": bool(output_status_word & (1 << z)) if has_output_status else False,  # Node_Turck has no running feedback
            "fault": aux_power_fault,  # Zone inherits node-level fault
        }

    any_running = any(z["running"] for z in zones.values())
    any_product = any(z["part_present"] for z in zones.values())

    # Find network info
    network = ""
    node_type = ""
    for net, cfg in NETWORKS.items():
        if node_name.startswith(net):
            network = net
            node_type = cfg["type"]
            break

    return {
        "id": node_name,
        "name": node_name,
        "network": network,
        "type": "Node_Turck" if not has_output_status else node_type,
        "online": True,
        "running": any_running,
        "fault": aux_power_fault,  # From {node}.I.Data.15 (Aux Power Fault)
        "has_product": any_product,
        "zones": zones,
    }


def get_all_nodes(network: str = None) -> list[dict]:
    """Get status of all nodes, optionally filtered by network"""
    nodes = []
    for node in NODE_LIST:
        if network and node["network"] != network:
            continue
        status = get_node_status(node["name"])
        nodes.append(status)
    return nodes


def get_networks_summary() -> list[dict]:
    """Get summary of all networks"""
    summaries = []
    for net_name, config in NETWORKS.items():
        node_count = len(config["nodes"])
        nodes = get_all_nodes(net_name)
        running_count = sum(1 for n in nodes if n.get("running"))
        fault_count = sum(1 for n in nodes if n.get("fault"))

        summaries.append({
            "network": net_name,
            "type": config["type"],
            "node_count": node_count,
            "running_count": running_count,
            "fault_count": fault_count,
        })
    return summaries


def start_node(node_name: str, zone: int = None) -> bool:
    """Send start command to a node zone (or all zones)"""
    if MOCK_MODE:
        if node_name in MOCK_DATA["nodes"]:
            zones = MOCK_DATA["nodes"][node_name]["zones"]
            if zone:
                if zone in zones:
                    zones[zone]["running"] = True
            else:
                for z in zones.values():
                    z["running"] = True
        return True

    # Real PLC write - set zone bit(s) in O.Data
    if zone:
        tag = f"{node_name}.O.Data.{zone}"
        return write_tag(tag, True)
    else:
        # Turn on all zones (bits 1-8)
        tag = f"{node_name}.O.Data"
        return write_tag(tag, 0x01FE)  # Bits 1-8 set


def stop_node(node_name: str, zone: int = None) -> bool:
    """Send stop command to a node zone (or all zones)"""
    if MOCK_MODE:
        if node_name in MOCK_DATA["nodes"]:
            zones = MOCK_DATA["nodes"][node_name]["zones"]
            if zone:
                if zone in zones:
                    zones[zone]["running"] = False
            else:
                for z in zones.values():
                    z["running"] = False
        return True

    # Real PLC write - clear zone bit(s) in O.Data
    if zone:
        tag = f"{node_name}.O.Data.{zone}"
        return write_tag(tag, False)
    else:
        tag = f"{node_name}.O.Data"
        return write_tag(tag, 0)


def jog_node(node_name: str, direction: str, zone: int = None) -> bool:
    """Jog a node forward or reverse (for transfer nodes like DN1_02)"""
    if MOCK_MODE:
        return True

    # Transfer nodes have different control: .O.Data.1 = reverse, .O.Data.2 = forward
    if direction == "forward":
        tag = f"{node_name}.O.Data.2"
    elif direction == "reverse":
        tag = f"{node_name}.O.Data.1"
    else:
        return False

    return write_tag(tag, True)


def get_package_status(package_id: int) -> dict:
    """Get status of a package"""
    if MOCK_MODE:
        return MOCK_DATA["packages"].get(package_id, {
            "id": package_id,
            "location": "",
            "destination": "",
            "status": 0,
        })

    # Would need actual package tracking tags from PLC
    return {"id": package_id, "location": "", "destination": "", "status": 0}


def get_all_packages() -> list[dict]:
    """Get status of all active packages"""
    if MOCK_MODE:
        return list(MOCK_DATA["packages"].values())
    return []


def route_package(package_id: int, destination: str) -> bool:
    """Set destination for a package"""
    if MOCK_MODE:
        if package_id in MOCK_DATA["packages"]:
            MOCK_DATA["packages"][package_id]["destination"] = destination
        return True
    return True
