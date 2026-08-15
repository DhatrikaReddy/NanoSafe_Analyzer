import sqlite3

conn = sqlite3.connect('nanosafe.db')
cur = conn.cursor()

# Show what will be deleted
cur.execute('SELECT id, username, email FROM users')
users = cur.fetchall()
print('Users to be removed:')
for u in users:
    print(f'  ID: {u[0]} | User: {u[1]} | Email: {u[2]}')

# Clear related tables first (foreign keys)
cur.execute('DELETE FROM email_verification_tokens')
cur.execute('DELETE FROM password_reset_tokens')
cur.execute('DELETE FROM audit_logs')
cur.execute('DELETE FROM users')

print(f'\nDeleted {len(users)} user(s).')
print('All credentials removed. Database is clean.')

conn.commit()
conn.close()
