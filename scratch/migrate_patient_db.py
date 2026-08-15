import sqlite3

conn = sqlite3.connect("nanosafe.db")
cursor = conn.cursor()

columns = [row[1] for row in cursor.execute("PRAGMA table_info(study_participants)").fetchall()]
print("Existing columns in study_participants:", columns)

new_cols = [
    ("name", "VARCHAR(150) DEFAULT ''"),
    ("blood_group", "VARCHAR(10) DEFAULT ''"),
    ("email", "VARCHAR(120) DEFAULT ''"),
    ("phone", "VARCHAR(30) DEFAULT ''"),
    ("medical_history", "TEXT DEFAULT ''")
]

for col_name, col_type in new_cols:
    if col_name not in columns:
        cursor.execute(f"ALTER TABLE study_participants ADD COLUMN {col_name} {col_type}")
        print(f"Added column: {col_name}")
    else:
        print(f"Column already exists: {col_name}")

conn.commit()
conn.close()
print("Migration completed successfully!")
