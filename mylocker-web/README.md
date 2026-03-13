# MyLocker Web Interface

Web-based HMI for Allen-Bradley PLC conveyor control system.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React Web UI  │◄───►│  FastAPI Backend │◄───►│ Allen-Bradley   │
│   (Browser)     │ WS  │  + pycomm3       │ EIP │     PLC         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Set `MOCK_MODE=True` in `plc/config.py` for development without PLC.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/conveyors | List all conveyors |
| GET | /api/conveyors/{id} | Get conveyor details |
| POST | /api/conveyors/{id}/start | Start conveyor |
| POST | /api/conveyors/{id}/stop | Stop conveyor |
| POST | /api/conveyors/{id}/jog | Jog conveyor |
| GET | /api/packages | List all packages |
| GET | /api/packages/{id} | Get package status |
| POST | /api/packages/{id}/route | Route package |
| WS | /ws/status | Real-time updates |

## Configuration

### PLC Settings

Edit `backend/plc/config.py`:

```python
PLC_IP = "192.168.1.100"  # Your PLC IP
MOCK_MODE = True          # Set False for real PLC
```

### Tag Mapping

Define conveyor and package tags in `backend/plc/config.py`.

## Features

- Real-time conveyor status monitoring
- Interactive factory floor map
- Manual conveyor controls (start/stop/jog)
- Package tracking and routing
- Searchable dashboard
