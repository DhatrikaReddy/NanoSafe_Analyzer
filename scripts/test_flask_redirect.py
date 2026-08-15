import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app

app = create_app()
app.config['WTF_CSRF_ENABLED'] = False
app.config['TESTING'] = True

with app.test_client() as client:
    response = client.post('/auth/login', data={
        'username': 'admin',
        'password': 'AdminPassword123!'
    })
    print("Admin login redirect:", response.headers.get("Location"))
    if not response.headers.get("Location"):
        print("Admin response:", response.data.decode('utf-8'))

    response = client.post('/auth/login', data={
        'username': 'testuser',
        'password': 'testpassword123'
    })
    print("Testuser login redirect:", response.headers.get("Location"))
    if not response.headers.get("Location"):
        print("TestUser response:", response.data.decode('utf-8'))

    response = client.post('/auth/login', data={
        'username': 'TestUser',
        'password': 'testpassword123'
    })
    print("TestUser exact case login redirect:", response.headers.get("Location"))
