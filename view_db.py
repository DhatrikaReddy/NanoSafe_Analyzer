"""
view_db.py — Quick tool to inspect SQLite database (nanosafe.db)

Usage:
    python view_db.py              # List all tables and row counts
    python view_db.py users        # Show all records in the 'users' table
    python view_db.py <table_name> # Show records in any specified table
"""

import sys
import sqlite3

DB_FILE = 'nanosafe.db'

def show_tables():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in c.fetchall() if not r[0].startswith('sqlite_')]
    
    print("\n" + "=" * 50)
    print(f"DATABASE: {DB_FILE} ({len(tables)} tables)")
    print("=" * 50)
    for table in tables:
        c.execute(f'SELECT COUNT(*) FROM "{table}"')
        count = c.fetchone()[0]
        print(f"  * {table:<28} : {count} rows")
    print("\nTip: Run `python view_db.py <table_name>` to inspect records.\n")
    conn.close()

def show_table_data(table_name):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    try:
        c.execute(f'SELECT * FROM "{table_name}" LIMIT 20')
        rows = c.fetchall()
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
        conn.close()
        return

    if not rows:
        print(f"\nTable '{table_name}' is currently empty (0 rows).\n")
        conn.close()
        return

    columns = [col[0] for col in c.description]
    print("\n" + "=" * 80)
    print(f"TABLE: {table_name} (Showing up to 20 rows)")
    print("=" * 80)
    print(" | ".join(f"{col:<15}" for col in columns))
    print("-" * 80)
    for row in rows:
        row_values = []
        for col in columns:
            val = str(row[col]) if row[col] is not None else "NULL"
            if len(val) > 18:
                val = val[:15] + "..."
            row_values.append(f"{val:<15}")
        print(" | ".join(row_values))
    print("=" * 80 + "\n")
    conn.close()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        show_table_data(sys.argv[1])
    else:
        show_tables()
