"""Database access layer for MyLocker web API"""

import os
import pyodbc
from datetime import datetime
from typing import List, Dict, Any, Optional

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "mylocker.accdb")


def get_connection():
    """Get database connection"""
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={DB_PATH};"
    )
    return pyodbc.connect(conn_str)


def get_all_nodes(network: str = None) -> List[Dict[str, Any]]:
    """Get all nodes, optionally filtered by network"""
    conn = get_connection()
    cursor = conn.cursor()

    if network:
        cursor.execute("""
            SELECT NodeName, Network, NodeType, InputData, OutputStatus,
                   IsOnline, IsRunning, HasFault, HasProduct, LastUpdated
            FROM Nodes
            WHERE Network = ?
            ORDER BY NodeName
        """, (network,))
    else:
        cursor.execute("""
            SELECT NodeName, Network, NodeType, InputData, OutputStatus,
                   IsOnline, IsRunning, HasFault, HasProduct, LastUpdated
            FROM Nodes
            ORDER BY NodeName
        """)

    nodes = []
    for row in cursor.fetchall():
        node = {
            "id": row.NodeName,
            "name": row.NodeName,
            "network": row.Network,
            "type": row.NodeType or "Unknown",
            "online": bool(row.IsOnline),
            "running": bool(row.IsRunning),
            "fault": bool(row.HasFault),
            "has_product": bool(row.HasProduct),
            "input_data": row.InputData,
            "output_status": row.OutputStatus,
            "last_updated": row.LastUpdated.isoformat() if row.LastUpdated else None,
            "zones": {},
        }
        nodes.append(node)

    # Get zones for all nodes
    node_names = [n["name"] for n in nodes]
    if node_names:
        placeholders = ",".join(["?" for _ in node_names])
        cursor.execute(f"""
            SELECT NodeName, ZoneNum, PartPresent, IsRunning, HasFault
            FROM Zones
            WHERE NodeName IN ({placeholders})
        """, node_names)

        for row in cursor.fetchall():
            # Find the node and add zone data
            for node in nodes:
                if node["name"] == row.NodeName:
                    node["zones"][row.ZoneNum] = {
                        "part_present": bool(row.PartPresent),
                        "running": bool(row.IsRunning),
                        "fault": bool(row.HasFault),
                    }
                    break

    conn.close()
    return nodes


def get_node(node_name: str) -> Optional[Dict[str, Any]]:
    """Get a single node by name"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT NodeName, Network, NodeType, InputData, OutputStatus,
               IsOnline, IsRunning, HasFault, HasProduct, LastUpdated
        FROM Nodes
        WHERE NodeName = ?
    """, (node_name,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    node = {
        "id": row.NodeName,
        "name": row.NodeName,
        "network": row.Network,
        "type": row.NodeType or "Unknown",
        "online": bool(row.IsOnline),
        "running": bool(row.IsRunning),
        "fault": bool(row.HasFault),
        "has_product": bool(row.HasProduct),
        "input_data": row.InputData,
        "output_status": row.OutputStatus,
        "last_updated": row.LastUpdated.isoformat() if row.LastUpdated else None,
        "zones": {},
    }

    # Get zones
    cursor.execute("""
        SELECT ZoneNum, PartPresent, IsRunning, HasFault
        FROM Zones
        WHERE NodeName = ?
        ORDER BY ZoneNum
    """, (node_name,))

    for row in cursor.fetchall():
        node["zones"][row.ZoneNum] = {
            "part_present": bool(row.PartPresent),
            "running": bool(row.IsRunning),
            "fault": bool(row.HasFault),
        }

    conn.close()
    return node


def get_networks_summary() -> List[Dict[str, Any]]:
    """Get summary of all networks"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT Network,
               COUNT(*) as NodeCount,
               SUM(IIF(IsRunning, 1, 0)) as RunningCount,
               SUM(IIF(HasFault, 1, 0)) as FaultCount,
               SUM(IIF(IsOnline, 1, 0)) as OnlineCount
        FROM Nodes
        GROUP BY Network
        ORDER BY Network
    """)

    summaries = []
    for row in cursor.fetchall():
        summaries.append({
            "network": row.Network,
            "node_count": row.NodeCount,
            "running_count": row.RunningCount or 0,
            "fault_count": row.FaultCount or 0,
            "online_count": row.OnlineCount or 0,
        })

    conn.close()
    return summaries


def get_available_networks() -> List[str]:
    """Get list of networks with nodes"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT Network FROM Nodes ORDER BY Network")
    networks = [row.Network for row in cursor.fetchall()]
    conn.close()
    return networks


def queue_command(node_name: str, command_type: str, zone: int = None, value: str = None) -> int:
    """Queue a command for the PLC service to process"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO Commands (NodeName, CommandType, Zone, CommandValue, Status, CreatedAt)
        VALUES (?, ?, ?, ?, 'pending', ?)
    """, (node_name, command_type, zone, value, datetime.now()))

    # Get the inserted ID
    cursor.execute("SELECT @@IDENTITY")
    cmd_id = cursor.fetchone()[0]

    conn.commit()
    conn.close()
    return cmd_id


def get_command_status(command_id: int) -> Optional[Dict[str, Any]]:
    """Get status of a command"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT CommandID, NodeName, CommandType, Zone, CommandValue, Status, CreatedAt, ProcessedAt
        FROM Commands
        WHERE CommandID = ?
    """, (command_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row.CommandID,
        "node_name": row.NodeName,
        "command_type": row.CommandType,
        "zone": row.Zone,
        "value": row.CommandValue,
        "status": row.Status,
        "created_at": row.CreatedAt.isoformat() if row.CreatedAt else None,
        "processed_at": row.ProcessedAt.isoformat() if row.ProcessedAt else None,
    }


def get_config() -> Dict[str, str]:
    """Get all config values"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT ConfigKey, ConfigCommandValue FROM Config")
    config = {row.ConfigKey: row.ConfigCommandValue for row in cursor.fetchall()}
    conn.close()
    return config


def set_config(key: str, value: str):
    """Set a config value"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE Config SET ConfigCommandValue = ? WHERE ConfigKey = ?", (value, key))
    if cursor.rowcount == 0:
        cursor.execute("INSERT INTO Config (ConfigKey, ConfigCommandValue) VALUES (?, ?)", (key, value))

    conn.commit()
    conn.close()


def get_service_status() -> Dict[str, Any]:
    """Check if PLC service is running by looking at last update times"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT MAX(LastUpdated) as LastUpdate FROM Nodes")
    row = cursor.fetchone()
    conn.close()

    if row and row.LastUpdate:
        last_update = row.LastUpdate
        age_seconds = (datetime.now() - last_update).total_seconds()
        is_running = age_seconds < 10  # Consider running if updated within 10 seconds
        return {
            "plc_service_running": is_running,
            "last_update": last_update.isoformat(),
            "age_seconds": age_seconds,
        }

    return {
        "plc_service_running": False,
        "last_update": None,
        "age_seconds": None,
    }
