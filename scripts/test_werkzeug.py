from werkzeug.security import generate_password_hash, check_password_hash

hash_val = "pbkdf2:sha256:600000$wyur1GWxyaJ3LMyg$609d6718fbe041bd491cfd539be32f8b5377b7051284e3e37205a4d59a59fb73"
print("Admin@NanoSafe2026! :", check_password_hash(hash_val, "Admin@NanoSafe2026!"))
print("admin123 :", check_password_hash(hash_val, "admin123"))
print("admin :", check_password_hash(hash_val, "admin"))

test_hash = generate_password_hash("Admin@NanoSafe2026!")
print("test_hash:", test_hash)
print("verify test_hash:", check_password_hash(test_hash, "Admin@NanoSafe2026!"))

import bcrypt
test_bcrypt = bcrypt.hashpw(b"Admin@NanoSafe2026!", bcrypt.gensalt()).decode('utf-8')
print("test_bcrypt:", test_bcrypt)
