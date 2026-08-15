"""participants/__init__.py — NanoSafe Analyzer: Study Participants Blueprint"""

from flask import Blueprint

participants_bp = Blueprint("participants", __name__, url_prefix="/participants")

from . import routes  # noqa: E402,F401
