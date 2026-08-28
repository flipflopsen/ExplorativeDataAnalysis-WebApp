import sqlite3
import os
import pandas as pd

# --- CONFIGURATION ---
DB_NAME = '01_data/databases/project_data.db'
TABLE_NAME = 'processed_metrics'

def initialize_database():
    """Ensures the database connection is established and the table exists."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Check if table exists and create it if not
    cursor.execute(f'''
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_name TEXT NOT NULL,
            metric_value REAL NOT NULL,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print(f"--- Database '{DB_NAME}' initialized successfully. ---")


def write_to_db(data_list):
    """Inserts a list of (metric_name, metric_value) tuples into the DB."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Use executemany for efficient batch insertion
    cursor.executemany(
        f"INSERT INTO {TABLE_NAME} (metric_name, metric_value) VALUES (?, ?)",
        data_list
    )
    conn.commit()
    conn.close()
    print(f"--- Successfully inserted {len(data_list)} records into '{TABLE_NAME}'. ---")


def read_from_db():
    """Retrieves all data from the database using pandas for easy reading."""
    conn = sqlite3.connect(DB_NAME)
    # Read the data into a pandas DataFrame
    df = pd.read_sql_query(f"SELECT * FROM {TABLE_NAME} ORDER BY recorded_at DESC", conn)
    conn.close()
    return df


def run_etl_pipeline():
    """Simulates a basic Extract, Transform, Load (ETL) cycle using the database."""
    
    # 1. SETUP
    initialize_database()

    # 2. EXTRACT & TRANSFORM (Simulated Data)
    print("\n--- Starting Data Transformation & Insertion ---")
    
    # Simulate data that would normally come from APIs or complex calculations
    new_metrics = [
        ('cpu_usage', 78.5),
        ('memory_usage', 62.1),
        ('network_latency', 12.4)
    ]
    
    # 3. LOAD
    write_to_db(new_metrics)

    # 4. VALIDATE (Read back the data)
    print("\n--- Reading Latest Data from Database ---")
    df_result = read_from_db()
    
    if not df_result.empty:
        print("Successfully retrieved the latest records:")
        print(df_result)
    else:
        print("No data found in the database.")

if __name__ == "__main__":
    # Ensure pandas and sqlite3 are installed: pip install pandas
    run_etl_pipeline()