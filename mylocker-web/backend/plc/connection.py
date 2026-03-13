"""PLC Connection Manager"""

import logging
from contextlib import contextmanager
from typing import Optional

from .config import PLC_CONFIG, MOCK_MODE

logger = logging.getLogger(__name__)

# Only import pycomm3 if not in mock mode
if not MOCK_MODE:
    from pycomm3 import LogixDriver

# Cache for nodes that don't have OutputStatus (Node_Turck type)
_nodes_without_output_status = set()


class PLCConnection:
    """Manages connection to Allen-Bradley PLC"""

    _instance: Optional["PLCConnection"] = None
    _driver: Optional["LogixDriver"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        self._connected = False

    @property
    def is_mock(self) -> bool:
        return MOCK_MODE

    @property
    def is_connected(self) -> bool:
        if MOCK_MODE:
            return True
        return self._connected and self._driver is not None

    def connect(self) -> bool:
        """Establish connection to PLC"""
        if MOCK_MODE:
            logger.info("Running in MOCK_MODE - no actual PLC connection")
            self._connected = True
            return True

        try:
            self._driver = LogixDriver(
                PLC_CONFIG["ip"],
                slot=PLC_CONFIG["slot"],
                init_tags=True,
                init_program_tags=True,
            )
            self._driver.open()
            self._connected = True
            logger.info(f"Connected to PLC at {PLC_CONFIG['ip']}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to PLC: {e}")
            self._connected = False
            return False

    def disconnect(self):
        """Close PLC connection"""
        if MOCK_MODE:
            self._connected = False
            return

        if self._driver:
            try:
                self._driver.close()
            except Exception as e:
                logger.error(f"Error closing PLC connection: {e}")
            finally:
                self._driver = None
                self._connected = False

    @contextmanager
    def get_driver(self):
        """Context manager for PLC driver access"""
        if MOCK_MODE:
            yield None
            return

        if not self.is_connected:
            self.connect()

        yield self._driver

    def read(self, tag: str):
        """Read a single tag from PLC"""
        if MOCK_MODE:
            return None

        with self.get_driver() as driver:
            if driver:
                result = driver.read(tag)
                if result:
                    if result.error:
                        logger.error(f"Error reading {tag}: {result.error}")
                        return None
                    return result.value
                else:
                    logger.error(f"No result for tag {tag}")
        return None

    def write(self, tag: str, value) -> bool:
        """Write a value to a PLC tag"""
        if MOCK_MODE:
            logger.info(f"MOCK: Would write {value} to {tag}")
            return True

        with self.get_driver() as driver:
            if driver:
                result = driver.write(tag, value)
                return result.error is None if result else False
        return False

    def read_multiple(self, tags: list[str]) -> dict:
        """Read multiple tags at once"""
        if MOCK_MODE:
            return {}

        with self.get_driver() as driver:
            if driver:
                results = driver.read(*tags)
                # Handle single tag (returns Tag) vs multiple tags (returns list)
                if not isinstance(results, list):
                    results = [results]
                return {r.tag: r.value for r in results if r and not r.error}
        return {}

    def has_output_status(self, node_name: str) -> bool:
        """Check if a node has OutputStatus tag (Node_AB vs Node_Turck)"""
        global _nodes_without_output_status

        # Check cache first
        if node_name in _nodes_without_output_status:
            return False

        if MOCK_MODE:
            return True

        # Check the driver's tag list
        with self.get_driver() as driver:
            if driver and hasattr(driver, 'tags'):
                tag_name = f"{node_name}.I.OutputStatus"
                # Check if the tag structure supports OutputStatus
                base_tag = driver.tags.get(node_name)
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


# Global connection instance
plc = PLCConnection()
