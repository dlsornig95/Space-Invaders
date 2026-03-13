"""Create and initialize the MyLocker Access database"""

import os
import pyodbc

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "mylocker.accdb")

def get_connection_string():
    """Get ODBC connection string for Access database"""
    return (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={DB_PATH};"
    )

def create_database():
    """Create the Access database file if it doesn't exist"""
    if os.path.exists(DB_PATH):
        print(f"Database already exists: {DB_PATH}")
        return True

    # Create new Access database using ADOX (via COM)
    try:
        import win32com.client
        catalog = win32com.client.Dispatch("ADOX.Catalog")
        catalog.Create(f"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={DB_PATH};")
        print(f"Created database: {DB_PATH}")
        return True
    except Exception as e:
        print(f"Error creating database: {e}")
        print("Make sure Microsoft Access Database Engine is installed.")
        print("Download from: https://www.microsoft.com/en-us/download/details.aspx?id=54920")
        return False

def create_tables():
    """Create the database tables"""
    conn = pyodbc.connect(get_connection_string())
    cursor = conn.cursor()

    # Nodes table - stores current state of each node
    # Note: Access uses YESNO for boolean, not BIT
    try:
        cursor.execute("""
            CREATE TABLE Nodes (
                NodeName VARCHAR(20) PRIMARY KEY,
                Network VARCHAR(10),
                NodeType VARCHAR(20),
                InputData INTEGER,
                OutputStatus INTEGER,
                IsOnline YESNO,
                IsRunning YESNO,
                HasFault YESNO,
                HasProduct YESNO,
                LastUpdated DATETIME
            )
        """)
        print("Created Nodes table")
    except pyodbc.Error as e:
        if "already exists" in str(e):
            print("Nodes table already exists")
        else:
            raise

    # Commands table - pending commands from web to PLC
    try:
        cursor.execute("""
            CREATE TABLE Commands (
                CommandID COUNTER PRIMARY KEY,
                NodeName VARCHAR(20),
                CommandType VARCHAR(20),
                Zone INTEGER,
                CommandValue VARCHAR(50),
                Status VARCHAR(20),
                CreatedAt DATETIME,
                ProcessedAt DATETIME
            )
        """)
        print("Created Commands table")
    except pyodbc.Error as e:
        if "already exists" in str(e):
            print("Commands table already exists")
        else:
            raise

    # Zones table - stores zone-level detail for each node
    try:
        cursor.execute("""
            CREATE TABLE Zones (
                NodeName VARCHAR(20),
                ZoneNum INTEGER,
                PartPresent YESNO,
                IsRunning YESNO,
                HasFault YESNO,
                LastUpdated DATETIME,
                CONSTRAINT PK_Zones PRIMARY KEY (NodeName, ZoneNum)
            )
        """)
        print("Created Zones table")
    except pyodbc.Error as e:
        if "already exists" in str(e):
            print("Zones table already exists")
        else:
            raise

    # Config table - stores PLC connection settings
    try:
        cursor.execute("""
            CREATE TABLE Config (
                ConfigKey VARCHAR(50) PRIMARY KEY,
                ConfigValue VARCHAR(255)
            )
        """)
        print("Created Config table")

        # Insert default config
        cursor.execute("INSERT INTO Config (ConfigKey, ConfigValue) VALUES ('PLC_IP', '192.168.1.23')")
        cursor.execute("INSERT INTO Config (ConfigKey, ConfigValue) VALUES ('PLC_SLOT', '0')")
        cursor.execute("INSERT INTO Config (ConfigKey, ConfigValue) VALUES ('POLL_INTERVAL', '5.0')")
        cursor.execute("INSERT INTO Config (ConfigKey, ConfigValue) VALUES ('NETWORKS', 'DN1')")
        print("Inserted default config values")
    except pyodbc.Error as e:
        if "already exists" in str(e):
            print("Config table already exists")
        else:
            raise

    conn.commit()
    conn.close()
    print("Database setup complete!")

def init_nodes(networks=None):
    """Initialize nodes table with all known nodes"""
    if networks is None:
        networks = {"DN1": list(range(1, 45))}

    conn = pyodbc.connect(get_connection_string())
    cursor = conn.cursor()

    for network, node_nums in networks.items():
        for node_num in node_nums:
            node_name = f"{network}_{node_num:02d}"
            try:
                cursor.execute("""
                    INSERT INTO Nodes (NodeName, Network, NodeType, InputData, OutputStatus,
                                       IsOnline, IsRunning, HasFault, HasProduct, LastUpdated)
                    VALUES (?, ?, 'Unknown', 0, 0, 0, 0, 0, 0, NOW())
                """, (node_name, network))
            except pyodbc.Error:
                pass  # Node already exists

            # Initialize zones for this node
            for zone in range(1, 9):
                try:
                    cursor.execute("""
                        INSERT INTO Zones (NodeName, ZoneNum, PartPresent, IsRunning, HasFault, LastUpdated)
                        VALUES (?, ?, 0, 0, 0, NOW())
                    """, (node_name, zone))
                except pyodbc.Error:
                    pass  # Zone already exists

    conn.commit()
    conn.close()
    print(f"Initialized nodes for networks: {list(networks.keys())}")

if __name__ == "__main__":
    print("MyLocker Database Setup")
    print("=" * 40)

    if create_database():
        create_tables()
        init_nodes({"DN1": list(range(1, 45))})
