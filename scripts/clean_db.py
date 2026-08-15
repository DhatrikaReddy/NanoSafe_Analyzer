import sqlite3

conn = sqlite3.connect('nanosafe.db')
cursor = conn.cursor()

# Delete non-ZnO records
cursor.execute("DELETE FROM history WHERE sample_name NOT LIKE '%ZnO%' AND sample_name NOT LIKE '%Zinc%'")
deleted = cursor.rowcount

conn.commit()
conn.close()

print(f"Deleted {deleted} non-ZnO records from history.")
