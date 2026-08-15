import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app
from models import db, User
from werkzeug.security import generate_password_hash

app = create_app()
app.config['WTF_CSRF_ENABLED'] = False
app.config['TESTING'] = True

with app.app_context():
    # Restore admin's pbkdf2 hash
    admin = User.query.filter_by(username="admin").first()
    if admin:
        admin.password_hash = "pbkdf2:sha256:600000$wyur1GWxyaJ3LMyg$609d6718fbe041bd491cfd539be32f8b5377b7051284e3e37205a4d59a59fb73"
        db.session.commit()

with app.test_client() as client:
    response = client.post('/auth/login', data={
        'username': 'admin',
        'password': 'AdminPassword123!'
    })
    print("Admin login redirect:", response.headers.get("Location"))
    if not response.headers.get("Location"):
        print("Admin response:", response.data.decode('utf-8')[:300])
