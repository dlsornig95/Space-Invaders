"""WebSocket endpoint for real-time MCP3 status updates

Reads data from Access database (populated by plc_service.py)
"""

import asyncio
import json
import logging
from typing import Set, Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from db.access_db import get_all_nodes, get_networks_summary, get_available_networks, get_service_status

router = APIRouter()
logger = logging.getLogger(__name__)

# Connected WebSocket clients with their subscriptions
clients: Dict[WebSocket, dict] = {}

# Update interval in seconds
UPDATE_INTERVAL = 1.0


async def broadcast(message: dict):
    """Broadcast message to all connected clients"""
    if not clients:
        return

    data = json.dumps(message)
    disconnected = set()

    for client, sub in clients.items():
        try:
            # Filter nodes based on client subscription
            if sub.get("network"):
                filtered = message.copy()
                filtered["nodes"] = [
                    n for n in message.get("nodes", [])
                    if n.get("network") == sub["network"]
                ]
                await client.send_text(json.dumps(filtered))
            else:
                await client.send_text(data)
        except Exception:
            disconnected.add(client)

    # Remove disconnected clients
    for client in disconnected:
        clients.pop(client, None)


async def status_broadcaster():
    """Background task that broadcasts status updates from database"""
    while True:
        try:
            # Get all node statuses from database
            nodes = get_all_nodes()
            networks = get_networks_summary()
            service_status = get_service_status()

            await broadcast({
                "type": "status_update",
                "nodes": nodes,
                "packages": [],  # Package tracking not implemented yet
                "networks": networks,
                "plc_service_running": service_status["plc_service_running"],
            })
        except Exception as e:
            logger.error(f"Error broadcasting status: {e}")

        await asyncio.sleep(UPDATE_INTERVAL)


@router.websocket("/ws/status")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time status updates"""
    await websocket.accept()
    clients[websocket] = {"network": None}  # Default: all networks
    logger.info(f"WebSocket client connected. Total clients: {len(clients)}")

    try:
        # Send initial status from database
        nodes = get_all_nodes()
        networks = get_networks_summary()
        available = get_available_networks()
        service_status = get_service_status()

        await websocket.send_json({
            "type": "initial_status",
            "nodes": nodes,
            "packages": [],
            "networks": networks,
            "available_networks": available,
            "plc_service_running": service_status["plc_service_running"],
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                message = json.loads(data)

                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

                elif message.get("type") == "subscribe":
                    # Subscribe to specific network
                    network = message.get("network")
                    available = get_available_networks()
                    if network and network not in available:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Unknown network: {network}"
                        })
                    else:
                        clients[websocket]["network"] = network
                        await websocket.send_json({
                            "type": "subscribed",
                            "network": network or "all"
                        })

            except asyncio.TimeoutError:
                # Send keepalive
                await websocket.send_json({"type": "keepalive"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        clients.pop(websocket, None)
        logger.info(f"WebSocket client removed. Total clients: {len(clients)}")


def get_client_count() -> int:
    """Get number of connected WebSocket clients"""
    return len(clients)
