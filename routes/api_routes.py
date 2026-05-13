from flask import Blueprint, jsonify, request

from services.azure_content_safety import ContentSafetyError, analyze_text, test_connection


api_bp = Blueprint("api", __name__)


@api_bp.post("/analyze")
def analyze():
    data = request.get_json(silent=True) or {}
    try:
        result = analyze_text(
            text=data.get("text", ""),
            endpoint=data.get("endpoint"),
            api_key=data.get("apiKey"),
        )
        return jsonify({"success": True, "result": result})
    except ContentSafetyError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception:
        return jsonify({"success": False, "error": "Unexpected server error while analyzing content."}), 500


@api_bp.post("/test-connection")
def test_azure_connection():
    data = request.get_json(silent=True) or {}
    try:
        result = test_connection(endpoint=data.get("endpoint"), api_key=data.get("apiKey"))
        return jsonify({"success": True, "result": result})
    except ContentSafetyError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception:
        return jsonify({"success": False, "error": "Unexpected server error while testing Azure connection."}), 500


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "AI Shield API"})
