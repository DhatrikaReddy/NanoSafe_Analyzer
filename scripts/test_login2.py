import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app
from models import db, User
from auth.routes import verify_password_bcrypt

app = create_app()

with app.app_context():
    admin = User.query.filter_by(username="admin").first()
    if admin:
        test_pw = "Admin@NanoSafe2026!"
        print(f"Testing password '{test_pw}':", verify_password_bcrypt(test_pw, admin.password_hash))
