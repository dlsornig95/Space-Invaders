"""Tag Browser API for direct PLC tag access"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any

from plc.connection import plc
from plc.config import MOCK_MODE, NODE_LIST, NETWORKS, NODE_TAG_STRUCTURE

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagReadRequest(BaseModel):
    tags: List[str]


class TagWriteRequest(BaseModel):
    tag: str
    value: Any


class TagInfo(BaseModel):
    name: str
    example: str
    description: str


@router.get("/status")
async def get_connection_status():
    """Get PLC connection status"""
    return {
        "connected": plc.is_connected,
        "mock_mode": MOCK_MODE,
        "plc_ip": "192.168.5.58" if not MOCK_MODE else "N/A (Mock Mode)",
    }


@router.post("/connect")
async def connect_to_plc():
    """Attempt to connect to PLC"""
    if MOCK_MODE:
        return {"success": True, "message": "Running in mock mode - no real connection"}

    success = plc.connect()
    if success:
        return {"success": True, "message": "Connected to PLC"}
    else:
        raise HTTPException(status_code=500, detail="Failed to connect to PLC")


@router.post("/disconnect")
async def disconnect_from_plc():
    """Disconnect from PLC"""
    plc.disconnect()
    return {"success": True, "message": "Disconnected"}


@router.get("/structure")
async def get_tag_structure():
    """Get the tag structure documentation"""
    return {
        "node_tags": NODE_TAG_STRUCTURE,
        "networks": list(NETWORKS.keys()),
        "example_nodes": [n["name"] for n in NODE_LIST[:10]],
        "tag_examples": [
            {"tag": "DN1_17.I.Data", "description": "Input data - bits 1-8 part present, bit 15 fault"},
            {"tag": "DN1_17.I.OutputStatus", "description": "Zone running status - bits 1-8"},
            {"tag": "DN1_17.O.Data", "description": "Output commands - bits 1-8 zone on/off"},
            {"tag": "DN1_17.I.Data.15", "description": "Aux Power Fault bit"},
            {"tag": "DN1_17.I.Data.1", "description": "Zone 1 Part Present"},
        ],
    }


@router.get("/nodes")
async def get_available_nodes():
    """Get list of all node names for browsing"""
    nodes_by_network = {}
    for node in NODE_LIST:
        net = node["network"]
        if net not in nodes_by_network:
            nodes_by_network[net] = []
        nodes_by_network[net].append(node["name"])
    return nodes_by_network


@router.post("/read")
async def read_tags(request: TagReadRequest):
    """Read one or more tags from PLC"""
    if not request.tags:
        raise HTTPException(status_code=400, detail="No tags specified")

    if MOCK_MODE:
        # Return mock data for testing
        results = {}
        for tag in request.tags:
            if ".I.Data" in tag and ".I.Data." not in tag:
                results[tag] = 0b0000000011111110  # Zones 1-7 part present
            elif ".I.OutputStatus" in tag:
                results[tag] = 0b0000000001010101  # Zones 1,3,5,7 running
            elif ".O.Data" in tag and ".O.Data." not in tag:
                results[tag] = 0b0000000001010101
            elif tag.endswith(".15"):
                results[tag] = False  # No fault
            elif tag.endswith(".14"):
                results[tag] = True  # DeviceLogix enabled
            else:
                # Individual bit
                results[tag] = True
        return {"success": True, "results": results, "mock": True}

    # Real PLC read
    if len(request.tags) == 1:
        value = plc.read(request.tags[0])
        return {"success": True, "results": {request.tags[0]: value}, "mock": False}
    else:
        values = plc.read_multiple(request.tags)
        return {"success": True, "results": values, "mock": False}


@router.post("/write")
async def write_tag(request: TagWriteRequest):
    """Write a value to a PLC tag"""
    if MOCK_MODE:
        return {
            "success": True,
            "message": f"Mock write: {request.tag} = {request.value}",
            "mock": True
        }

    success = plc.write(request.tag, request.value)
    if success:
        return {"success": True, "message": f"Wrote {request.value} to {request.tag}"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to write to {request.tag}")


@router.get("/read/{tag:path}")
async def read_single_tag(tag: str):
    """Read a single tag by path (GET request for easy testing)"""
    if MOCK_MODE:
        # Return mock data
        if ".I.Data" in tag and not any(tag.endswith(f".{i}") for i in range(16)):
            value = 0b0000000011111110
        elif ".I.OutputStatus" in tag:
            value = 0b0000000001010101
        elif tag.endswith(".15"):
            value = False
        else:
            value = True
        return {"tag": tag, "value": value, "mock": True}

    value = plc.read(tag)
    return {"tag": tag, "value": value, "mock": False}
