"""
PLC Service - Standalone process that manages PLC communication

This service:
1. Maintains a single connection to the PLC
2. Polls PLC tags at regular intervals
3. Writes current state to Access database
4. Processes pending commands from database and sends to PLC
"""

import os
import sys
import time
import logging
import pyodbc
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from pycomm3 import LogixDriver

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("PLCService")

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "db", "mylocker.accdb")

# Cache for nodes without OutputStatus (Node_Turck type)
_nodes_without_output_status = set()


class PLCService:
    def __init__(self):
        self.driver = None
        self.plc_ip = None
        self.plc_slot = None
        self.poll_interval = 1.0
        self.networks = {}
        self.running = False

    def get_db_connection(self):
        """Get database connection"""
        conn_str = (
            r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
            f"DBQ={DB_PATH};"
        )
        return pyodbc.connect(conn_str)

    def load_config(self):
        """Load configuration from database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT ConfigKey, ConfigValue FROM Config")
        config = {row.ConfigKey: row.ConfigValue for row in cursor.fetchall()}

        self.plc_ip = config.get("PLC_IP", "192.168.1.23")
        self.plc_slot = int(config.get("PLC_SLOT", "0"))
        self.poll_interval = float(config.get("POLL_INTERVAL", "1.0"))

        # Parse networks config
        networks_str = config.get("NETWORKS", "DN1")
        network_ranges = {
            "DN1": list(range(1, 45)),
            "DN2": list(range(1, 57)),
            "EN3": list(range(1, 115)),
            "DN4": list(range(1, 57)),
            "DN5": list(range(1, 45)),
        }
        for net in networks_str.split(","):
            net = net.strip()
            if net in network_ranges:
                self.networks[net] = network_ranges[net]

        conn.close()
        logger.info(f"Config loaded: PLC={self.plc_ip}, Slot={self.plc_slot}, "
                    f"Poll={self.poll_interval}s, Networks={list(self.networks.keys())}")

    def connect_plc(self):
        """Establish connection to PLC"""
        try:
            self.driver = LogixDriver(
                self.plc_ip,
                slot=self.plc_slot,
                init_tags=True,
                init_program_tags=True,
            )
            self.driver.open()
            logger.info(f"Connected to PLC at {self.plc_ip}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to PLC: {e}")
            return False

    def disconnect_plc(self):
        """Close PLC connection"""
        if self.driver:
            try:
                self.driver.close()
            except:
                pass
            self.driver = None
            logger.info("Disconnected from PLC")

    def has_output_status(self, node_name: str) -> bool:
        """Check if node has OutputStatus tag (Node_AB vs Node_Turck)"""
        global _nodes_without_output_status

        if node_name in _nodes_without_output_status:
            return False

        if self.driver and hasattr(self.driver, 'tags'):
            base_tag = self.driver.tags.get(node_name)
            if base_tag:
                data_type = base_tag.get('data_type', {})
                if isinstance(data_type, dict):
                    internal_tags = data_type.get('internal_tags', {})
                    i_tag = internal_tags.get('I', {})
                    if isinstance(i_tag, dict):
                        i_internal = i_tag.get('data_type', {}).get('internal_tags', {})
                        if 'OutputStatus' not in i_internal:
                            _nodes_without_output_status.add(node_name)
                            return False
        return True

    def read_node(self, node_name: str) -> dict:
        """Read a single node's status from PLC"""
        has_os = self.has_output_status(node_name)

        if has_os:
            tags = [f"{node_name}.I.Data", f"{node_name}.I.OutputStatus"]
        else:
            tags = [f"{node_name}.I.Data"]

        try:
            results = self.driver.read(*tags)
            if not isinstance(results, list):
                results = [results]

            values = {r.tag: r.value for r in results if r and not r.error}
        except Exception as e:
            logger.debug(f"Error reading {node_name}: {e}")
            return None

        input_data = values.get(f"{node_name}.I.Data", 0) or 0
        output_status = values.get(f"{node_name}.I.OutputStatus", 0) or 0 if has_os else 0

        # Parse bits
        aux_power_fault = bool(input_data & (1 << 15))

        zones = {}
        any_running = False
        any_product = False
        for z in range(1, 9):
            part_present = bool(input_data & (1 << z))
            running = bool(output_status & (1 << z)) if has_os else False
            zones[z] = {
                "part_present": part_present,
                "running": running,
                "fault": aux_power_fault,
            }
            if running:
                any_running = True
            if part_present:
                any_product = True

        return {
            "node_name": node_name,
            "node_type": "Node_Turck" if not has_os else "Node_AB",
            "input_data": input_data,
            "output_status": output_status,
            "is_online": True,
            "is_running": any_running,
            "has_fault": aux_power_fault,
            "has_product": any_product,
            "zones": zones,
        }

    def update_database(self, node_data: dict):
        """Update database with node status"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        now = datetime.now()

        # Update Nodes table
        cursor.execute("""
            UPDATE Nodes SET
                NodeType = ?,
                InputData = ?,
                OutputStatus = ?,
                IsOnline = ?,
                IsRunning = ?,
                HasFault = ?,
                HasProduct = ?,
                LastUpdated = ?
            WHERE NodeName = ?
        """, (
            node_data["node_type"],
            node_data["input_data"],
            node_data["output_status"],
            node_data["is_online"],
            node_data["is_running"],
            node_data["has_fault"],
            node_data["has_product"],
            now,
            node_data["node_name"],
        ))

        # If node doesn't exist, insert it
        if cursor.rowcount == 0:
            network = node_data["node_name"].split("_")[0]
            cursor.execute("""
                INSERT INTO Nodes (NodeName, Network, NodeType, InputData, OutputStatus,
                                   IsOnline, IsRunning, HasFault, HasProduct, LastUpdated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node_data["node_name"],
                network,
                node_data["node_type"],
                node_data["input_data"],
                node_data["output_status"],
                node_data["is_online"],
                node_data["is_running"],
                node_data["has_fault"],
                node_data["has_product"],
                now,
            ))

        # Update Zones table
        for zone_num, zone_data in node_data["zones"].items():
            cursor.execute("""
                UPDATE Zones SET
                    PartPresent = ?,
                    IsRunning = ?,
                    HasFault = ?,
                    LastUpdated = ?
                WHERE NodeName = ? AND ZoneNum = ?
            """, (
                zone_data["part_present"],
                zone_data["running"],
                zone_data["fault"],
                now,
                node_data["node_name"],
                zone_num,
            ))

            if cursor.rowcount == 0:
                cursor.execute("""
                    INSERT INTO Zones (NodeName, ZoneNum, PartPresent, IsRunning, HasFault, LastUpdated)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    node_data["node_name"],
                    zone_num,
                    zone_data["part_present"],
                    zone_data["running"],
                    zone_data["fault"],
                    now,
                ))

        conn.commit()
        conn.close()

    def mark_node_offline(self, node_name: str):
        """Mark a node as offline in the database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Nodes SET IsOnline = 0, LastUpdated = ? WHERE NodeName = ?
        """, (datetime.now(), node_name))
        conn.commit()
        conn.close()

    def process_commands(self):
        """Process pending commands from database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()

        # Get pending commands
        cursor.execute("""
            SELECT CommandID, NodeName, CommandType, Zone, CommandValue
            FROM Commands
            WHERE Status = 'pending'
            ORDER BY CreatedAt
        """)
        commands = cursor.fetchall()

        for cmd in commands:
            cmd_id, node_name, cmd_type, zone, cmd_value = cmd
            success = False

            try:
                if cmd_type == "start":
                    if zone:
                        tag = f"{node_name}.O.Data.{zone}"
                        result = self.driver.write(tag, True)
                    else:
                        tag = f"{node_name}.O.Data"
                        result = self.driver.write(tag, 0x01FE)  # Bits 1-8
                    success = result and not result.error

                elif cmd_type == "stop":
                    if zone:
                        tag = f"{node_name}.O.Data.{zone}"
                        result = self.driver.write(tag, False)
                    else:
                        tag = f"{node_name}.O.Data"
                        result = self.driver.write(tag, 0)
                    success = result and not result.error

                elif cmd_type == "write":
                    tag = f"{node_name}.{cmd_value.split('=')[0]}" if cmd_value and "=" in cmd_value else node_name
                    write_value = cmd_value.split("=")[1] if cmd_value and "=" in cmd_value else cmd_value
                    # Parse value type
                    if write_value and write_value.lower() == "true":
                        write_value = True
                    elif write_value and write_value.lower() == "false":
                        write_value = False
                    elif write_value and write_value.isdigit():
                        write_value = int(write_value)
                    result = self.driver.write(tag, write_value)
                    success = result and not result.error

                elif cmd_type == "jog":
                    # Jog command - cmd_value contains direction
                    if cmd_value == "forward":
                        tag = f"{node_name}.O.Data.2"
                    elif cmd_value == "reverse":
                        tag = f"{node_name}.O.Data.1"
                    else:
                        continue
                    result = self.driver.write(tag, True)
                    success = result and not result.error

                logger.info(f"Command {cmd_id}: {cmd_type} {node_name} zone={zone} -> {'OK' if success else 'FAIL'}")

            except Exception as e:
                logger.error(f"Command {cmd_id} failed: {e}")

            # Update command status
            status = "completed" if success else "failed"
            cursor.execute("""
                UPDATE Commands SET Status = ?, ProcessedAt = ? WHERE CommandID = ?
            """, (status, datetime.now(), cmd_id))

        conn.commit()
        conn.close()

    def poll_cycle(self):
        """Run one poll cycle - read all nodes and process commands"""
        # Read all nodes
        for network, node_nums in self.networks.items():
            for node_num in node_nums:
                node_name = f"{network}_{node_num:02d}"
                node_data = self.read_node(node_name)
                if node_data:
                    self.update_database(node_data)
                else:
                    self.mark_node_offline(node_name)

        # Process pending commands
        self.process_commands()

    def run(self):
        """Main service loop"""
        self.load_config()

        if not self.connect_plc():
            logger.error("Cannot start service without PLC connection")
            return

        self.running = True
        logger.info("PLC Service started")

        try:
            while self.running:
                start_time = time.time()

                try:
                    self.poll_cycle()
                except Exception as e:
                    logger.error(f"Poll cycle error: {e}")

                # Sleep for remaining interval
                elapsed = time.time() - start_time
                sleep_time = max(0, self.poll_interval - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            self.disconnect_plc()
            self.running = False
            logger.info("PLC Service stopped")

    def stop(self):
        """Stop the service"""
        self.running = False


if __name__ == "__main__":
    service = PLCService()
    service.run()
