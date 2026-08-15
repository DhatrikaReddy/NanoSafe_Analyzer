import sys
import os

# Append the current directory so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

try:
    from auth.routes import hash_password_bcrypt, verify_password_bcrypt
    pw = "testpassword123"
    hashed = hash_password_bcrypt(pw)
    print("Hashed:", hashed)
    print("Verify:", verify_password_bcrypt(pw, hashed))
    print("Verify Wrong:", verify_password_bcrypt("wrong", hashed))
except Exception as e:
    print("Error:", e)
