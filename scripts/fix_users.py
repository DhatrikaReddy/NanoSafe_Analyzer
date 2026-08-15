import sqlite3

conn = sqlite3.connect('nanosafe.db')
cur = conn.cursor()

# Activate all users who have a bcrypt hash but are not yet verified
cur.execute("UPDATE users SET is_verified=1, is_active=1 WHERE password_hash LIKE '$2b$%' AND (is_verified=0 OR is_active=0)")
print('Updated rows:', cur.rowcount)

conn.commit()

cur.execute('SELECT id, username, email, is_verified, is_active FROM users')
for r in cur.fetchall():
    print('ID:', r[0], '| User:', r[1], '| Email:', r[2], '| Verified:', r[3], '| Active:', r[4])

conn.close()
print('Done.')
