import sys
import os
import io

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app
from models import db, User

app = create_app()
app.config['WTF_CSRF_ENABLED'] = False
app.config['TESTING'] = True

with app.test_client() as client:
    with app.app_context():
        # Update admin password to bcrypt hash so we know it
        from auth.routes import hash_password_bcrypt
        admin = User.query.filter_by(username="admin").first()
        if admin:
            admin.password_hash = hash_password_bcrypt("Admin@NanoSafe2026!")
            db.session.commit()
            print("Admin password updated to bcrypt.")

    # Try login
    response = client.post('/login', data={
        'username': 'admin',
        'password': 'Admin@NanoSafe2026!'
    }, follow_redirects=True)
    
    html = response.data.decode('utf-8')
    if "Invalid username or password" in html:
        print("LOGIN FAILED: Invalid credentials")
    elif "Please verify your email" in html:
        print("LOGIN FAILED: Not verified")
    elif "Your account has been deactivated" in html:
        print("LOGIN FAILED: Deactivated")
    else:
        print("LOGIN SUCCESS? Checking session or response...")
        print("Response URL or snippet:")
        print(html[:500])
