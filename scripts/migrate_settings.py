import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'nanosafe.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE users ADD COLUMN notify_analysis_completed BOOLEAN DEFAULT 1;")
    print("Added notify_analysis_completed")
except sqlite3.OperationalError:
    print("Column notify_analysis_completed already exists")

try:
    cursor.execute("ALTER TABLE users ADD COLUMN notify_report_generated BOOLEAN DEFAULT 1;")
    print("Added notify_report_generated")
except sqlite3.OperationalError:
    print("Column notify_report_generated already exists")

try:
    cursor.execute("ALTER TABLE users ADD COLUMN notify_security_alerts BOOLEAN DEFAULT 1;")
    print("Added notify_security_alerts")
except sqlite3.OperationalError:
    print("Column notify_security_alerts already exists")

conn.commit()
conn.close()
print("Migration complete.")
