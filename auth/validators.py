"""
auth/validators.py — NanoSafe Analyzer: Input Validators
"""

import re


def strong_password(password: str) -> tuple[bool, str]:
    """Validate password strength. Returns (ok, error_message)."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit."
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Password must contain at least one special character."
    return True, ""


def valid_username(username: str) -> tuple[bool, str]:
    """Validate username format. Returns (ok, error_message)."""
    if len(username) < 3:
        return False, "Username must be at least 3 characters."
    if len(username) > 80:
        return False, "Username must be 80 characters or less."
    if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
        return False, "Username may only contain letters, digits, underscores, dots, or hyphens."
    return True, ""


def valid_email(email: str) -> tuple[bool, str]:
    """Basic email format validation."""
    if not email:
        return False, "Email address is required."
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email.strip()):
        return False, "Please enter a valid email address."
    if len(email) > 254:
        return False, "Email address is too long."
    return True, ""


def sanitize_input(value: str, max_len: int = 200) -> str:
    """Strip and truncate a string input."""
    if not value:
        return ""
    return str(value).strip()[:max_len]
