"""MCP3 Conveyor Node control API endpoints

Reads from Access database, queues commands for PLC service to process.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.access_db import (
    get_node,
    get_all_nodes,
    get_networks_summary,
    get_available_networks,
    queue_command,
    get_command_status,
)

router = APIRouter(prefix="/api/conveyors", tags=["conveyors"])


class JogRequest(BaseModel):
    direction: str  # "forward" or "reverse"
    zone: Optional[int] = None


class ZoneRequest(BaseModel):
    zone: Optional[int] = None  # If None, affects all zones


class ZoneStatus(BaseModel):
    part_present: bool
    running: bool
    fault: bool


class NodeResponse(BaseModel):
    id: str
    name: str
    network: str
    type: str
    online: bool
    running: bool
    fault: bool
    has_product: bool
    zones: dict


class NetworkSummary(BaseModel):
    network: str
    type: str
    node_count: int
    running_count: int
    fault_count: int


@router.get("/networks", response_model=list[NetworkSummary])
async def list_networks():
    """Get summary of all networks"""
    return get_networks_summary()


@router.get("", response_model=list[NodeResponse])
async def list_conveyors(network: Optional[str] = Query(None, description="Filter by network (DN1, DN2, EN3, etc.)")):
    """Get status of all conveyor nodes from database"""
    available = get_available_networks()
    if network and network not in available:
        raise HTTPException(status_code=400, detail=f"Unknown network: {network}. Valid: {available}")
    return get_all_nodes(network)


@router.get("/{node_id}", response_model=NodeResponse)
async def get_conveyor(node_id: str):
    """Get status of a specific node from database"""
    node = get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    return node


@router.post("/{node_id}/start")
async def start_conveyor_endpoint(node_id: str, request: ZoneRequest = None):
    """Queue a start command for a node (processed by PLC service)"""
    zone = request.zone if request else None
    cmd_id = queue_command(node_id, "start", zone)

    zone_msg = f" zone {zone}" if zone else " (all zones)"
    return {
        "status": "queued",
        "command_id": cmd_id,
        "message": f"Start command queued for {node_id}{zone_msg}"
    }


@router.post("/{node_id}/stop")
async def stop_conveyor_endpoint(node_id: str, request: ZoneRequest = None):
    """Queue a stop command for a node (processed by PLC service)"""
    zone = request.zone if request else None
    cmd_id = queue_command(node_id, "stop", zone)

    zone_msg = f" zone {zone}" if zone else " (all zones)"
    return {
        "status": "queued",
        "command_id": cmd_id,
        "message": f"Stop command queued for {node_id}{zone_msg}"
    }


@router.post("/{node_id}/jog")
async def jog_conveyor_endpoint(node_id: str, request: JogRequest):
    """Queue a jog command for a transfer node"""
    if request.direction not in ("forward", "reverse"):
        raise HTTPException(status_code=400, detail="Direction must be 'forward' or 'reverse'")

    cmd_id = queue_command(node_id, "jog", request.zone, request.direction)

    return {
        "status": "queued",
        "command_id": cmd_id,
        "message": f"Jog {request.direction} command queued for {node_id}"
    }


@router.get("/commands/{command_id}")
async def get_command(command_id: int):
    """Get status of a queued command"""
    cmd = get_command_status(command_id)
    if not cmd:
        raise HTTPException(status_code=404, detail=f"Command {command_id} not found")
    return cmd
