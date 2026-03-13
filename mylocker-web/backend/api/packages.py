"""Package tracking API endpoints"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from plc.tags import get_package_status, get_all_packages, route_package

router = APIRouter(prefix="/api/packages", tags=["packages"])


class RouteRequest(BaseModel):
    destination: int


class PackageResponse(BaseModel):
    id: int
    location: int
    destination: int
    status: int


@router.get("", response_model=list[PackageResponse])
async def list_packages():
    """Get all active packages"""
    return get_all_packages()


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package(package_id: int):
    """Get status of a specific package"""
    package = get_package_status(package_id)
    if not package or package.get("status", 0) == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return package


@router.post("/{package_id}/route")
async def route_package_endpoint(package_id: int, request: RouteRequest):
    """Route a package to a destination"""
    success = route_package(package_id, request.destination)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to route package")
    return {
        "status": "ok",
        "message": f"Package {package_id} routed to destination {request.destination}"
    }
