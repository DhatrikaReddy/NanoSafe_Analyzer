import sqlite3

db_path = 'nanosafe.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cols = [row[1] for row in cur.execute('PRAGMA table_info(users)').fetchall()]
print('Existing columns:', cols)

new_cols = {
    'research_role': 'TEXT DEFAULT ""',
    'default_cell_line': 'TEXT DEFAULT "HeLa"',
    'default_exposure_time': 'TEXT DEFAULT "24h"',
    'preferred_report_format': 'TEXT DEFAULT "pdf"',
    'notifications_enabled': 'INTEGER DEFAULT 1',
    'dark_mode': 'INTEGER DEFAULT 0',
}

for col, typedef in new_cols.items():
    if col not in cols:
        cur.execute(f'ALTER TABLE users ADD COLUMN {col} {typedef}')
        print(f'  Added: {col}')
    else:
        print(f'  Already exists: {col}')

conn.commit()
conn.close()
print('Migration complete.')
