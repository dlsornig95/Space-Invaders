========================================
MyLocker Web HMI - Deployment Guide
========================================

REQUIREMENTS
------------
- Windows 10/11
- Python 3.10 or higher
- Node.js 18 or higher
- Network access to the PLC (must be able to ping the PLC IP)


QUICK START
-----------
1. Copy the entire "mylocker-web" folder to the target PC

2. Run: deploy\install.bat
   - Installs Python and Node.js dependencies

3. Edit: deploy\config.bat
   - Set PLC_IP to your PLC's IP address
   - Set PLC_SLOT to the PLC slot number (0-indexed)
   - Set MOCK_MODE to "false" for real PLC

4. Run: deploy\start.bat
   - Starts backend and frontend servers
   - Opens browser to the app


CONFIGURATION (config.bat)
--------------------------
PLC_IP       - IP address of the Allen-Bradley PLC
PLC_SLOT     - Slot number (0 = first slot)
MOCK_MODE    - "true" for testing without PLC, "false" for real PLC
NETWORKS     - Comma-separated list: DN1,DN2,EN3,DN4,DN5
BACKEND_PORT - API server port (default: 8000)
FRONTEND_PORT- Web UI port (default: 5173)


NETWORK REQUIREMENTS
--------------------
The PC running this app must have DIRECT network access to the PLC:
- Must be able to ping the PLC IP address
- RSLinx gateway/proxy connections are NOT supported
- VPN or same subnet required if PLC is on different network


PRODUCTION PLC (T-Shirt Factory)
--------------------------------
IP: 192.168.5.58
Slot: 0
Networks: DN1, DN2, EN3, DN4, DN5


TROUBLESHOOTING
---------------
"Failed to connect to PLC"
  - Verify PLC_IP is correct
  - Test: ping <PLC_IP>
  - Check firewall allows port 44818 (EtherNet/IP)

"Tag doesn't exist"
  - Tag may not be in PLC program
  - Check NETWORKS setting matches your PLC

Frontend shows "Disconnected"
  - Backend may not be running
  - Check backend terminal for errors

Blank page / errors in browser
  - Open browser console (F12) for details
  - Verify VITE_API_URL matches backend address


MANUAL START (without batch files)
----------------------------------
Backend:
  cd backend
  set PLC_IP=192.168.5.58
  set PLC_SLOT=0
  set MOCK_MODE=false
  python main.py

Frontend:
  cd frontend
  set VITE_API_URL=http://localhost:8000
  npm run dev


ACCESSING FROM OTHER PCs
------------------------
If you want to access the web UI from other computers:

1. Start backend with: python main.py
   (binds to 0.0.0.0:8000 by default)

2. Start frontend with: npm run dev -- --host
   (allows external connections)

3. Access from other PC: http://<server-ip>:5173


CONTACT
-------
Daniel Sornig
daniel.sornig@utechconsulting.net
