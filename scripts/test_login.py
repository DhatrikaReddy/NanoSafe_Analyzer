import sys
import os

# Append the current directory so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app
from models import db, User
from auth.routes import hash_password_bcrypt, verify_password_bcrypt

app = create_app()

with app.app_context():
    print("Total users:", User.query.count())
    admin = User.query.filter_by(username="admin").first()
    if admin:
        print("Admin user found!")
        print("Email:", admin.email)
        print("Hash:", admin.password_hash)
        
        test_pw = "admin123"
        print(f"Testing password '{test_pw}':", verify_password_bcrypt(test_pw, admin.password_hash))
    else:
        print("Admin user not found.")
        
    first_user = User.query.first()
    if first_user:
        print("First user:", first_user.username)
        print("Hash:", first_user.password_hash)
