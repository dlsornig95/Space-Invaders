"""MyLocker Web Interface - FastAPI Backend

This web API reads from and writes to the Access database.
It does NOT connect to the PLC directly - that's handled by plc_service.py
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import conveyors_router, packages_router, websocket_router, tags_router
from api.websocket import status_broadcaster
from db.access_db import get_service_status

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting MyLocker Web Interface...")
    logger.info("This web API reads from the Access database.")
    logger.info("Make sure plc_service.py is running for live PLC data.")

    # Check if PLC service is running
    status = get_service_status()
    if status["plc_service_running"]:
        logger.info("PLC Service detected - database is being updated")
    else:
        logger.warning("PLC Service not detected - data may be stale")

    # Start background status broadcaster
    broadcaster_task = asyncio.create_task(status_broadcaster())

    yield

    # Shutdown
    logger.info("Shutting down...")
    broadcaster_task.cancel()
    try:
        await broadcaster_task
    except asyncio.CancelledError:
        pass

    logger.info("Shutdown complete")


app = FastAPI(
    title="MyLocker Web Interface",
    description="Web-based HMI for Allen-Bradley PLC conveyor control",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(conveyors_router)
app.include_router(packages_router)
app.include_router(websocket_router)
app.include_router(tags_router)


@app.get("/")
async def root():
    """Root endpoint with API info"""
    status = get_service_status()
    return {
        "name": "MyLocker Web Interface",
        "version": "2.0.0",
        "architecture": "database-driven",
        "plc_service_running": status["plc_service_running"],
        "last_data_update": status["last_update"],
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    status = get_service_status()
    return {
        "status": "healthy",
        "plc_service_running": status["plc_service_running"],
        "data_age_seconds": status["age_seconds"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
