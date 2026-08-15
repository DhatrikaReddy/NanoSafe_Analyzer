import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app
from models import db, User
from sqlalchemy import func

app = create_app()

with app.app_context():
    username = "testuser"
    user = User.query.filter((func.lower(User.username) == username.lower()) | (User.email == username.lower())).first()
    print("User found by lower:", user)
    
    user2 = User.query.filter_by(username="TestUser").first()
    print("User found exactly:", user2)
