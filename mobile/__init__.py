"""mobile/__init__.py — NanoSafe Analyzer Mobile App Blueprint"""

from flask import Blueprint, make_response, request

mobile_bp = Blueprint("mobile", __name__, url_prefix="/mobile/v1")

@mobile_bp.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    return response

from . import routes  # noqa: E402,F401

