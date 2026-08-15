import jwt
from functools import wraps
from flask import request, jsonify, current_app
from models import User

def jwt_required(f):
    """Decorator to require a valid PyJWT Token for API routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
            
        token = auth_header.split(" ")[1]

        # Local PyJWT decode
        try:
            secret = current_app.config.get("JWT_SECRET_KEY")
            decoded_token = jwt.decode(token, secret, algorithms=["HS256"])
            
            uid = decoded_token.get("uid")
            user = User.query.get(uid)
            
            if not user:
                return jsonify({"error": "User no longer exists"}), 401
                
            if not user.is_active:
                return jsonify({"error": "User account is disabled"}), 401
                
            request.uid = user.id
            request.user = user
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception as e:
            return jsonify({"error": f"Authentication error: {e}"}), 401
            
    return decorated
