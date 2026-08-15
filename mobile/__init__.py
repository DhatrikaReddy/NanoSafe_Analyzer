"""mobile/__init__.py — NanoSafe Analyzer Mobile App Blueprint"""

from flask import Blueprint

mobile_bp = Blueprint("mobile", __name__, url_prefix="/mobile/v1")

from . import routes  # noqa: E402,F401
