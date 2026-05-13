import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests


API_VERSION = "2024-09-01"
MAX_TEXT_LENGTH = 10_000
CATEGORIES = ["Hate", "SelfHarm", "Sexual", "Violence"]


class ContentSafetyError(Exception):
    """Raised when Azure Content Safety cannot complete a request."""


@dataclass
class AzureCredentials:
    endpoint: str
    api_key: str


def _clean_endpoint(endpoint: str) -> str:
    endpoint = (endpoint or "").strip()
    if not endpoint:
        raise ContentSafetyError("Azure endpoint is required.")
    if not re.match(r"^https://[a-zA-Z0-9.-]+/$|^https://[a-zA-Z0-9.-]+$", endpoint):
        raise ContentSafetyError("Endpoint must be a valid HTTPS Azure endpoint.")
    return endpoint.rstrip("/") + "/"


def resolve_credentials(endpoint: Optional[str], api_key: Optional[str]) -> AzureCredentials:
    resolved_endpoint = endpoint or os.getenv("AZURE_CONTENT_SAFETY_ENDPOINT", "")
    resolved_key = api_key or os.getenv("AZURE_CONTENT_SAFETY_KEY", "")

    if not resolved_key.strip():
        raise ContentSafetyError("Azure API key is required.")

    return AzureCredentials(endpoint=_clean_endpoint(resolved_endpoint), api_key=resolved_key.strip())


def analyze_text(text: str, endpoint: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
    if not text or not text.strip():
        raise ContentSafetyError("Text content is required.")
    if len(text) > MAX_TEXT_LENGTH:
        raise ContentSafetyError(f"Text exceeds Azure Content Safety's {MAX_TEXT_LENGTH} character limit.")

    credentials = resolve_credentials(endpoint, api_key)
    url = urljoin(credentials.endpoint, f"contentsafety/text:analyze?api-version={API_VERSION}")
    payload = {
        "text": text,
        "categories": CATEGORIES,
        "outputType": "EightSeverityLevels",
    }
    headers = {
        "Ocp-Apim-Subscription-Key": credentials.api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
    except requests.RequestException as exc:
        raise ContentSafetyError(f"Could not reach Azure Content Safety: {exc}") from exc

    if response.status_code >= 400:
        message = "Azure Content Safety request failed."
        try:
            details = response.json()
            message = details.get("error", {}).get("message") or details.get("message") or message
        except ValueError:
            if response.text:
                message = response.text[:300]
        raise ContentSafetyError(f"{message} (HTTP {response.status_code})")

    data = response.json()
    categories = _normalize_categories(data.get("categoriesAnalysis", []))
    max_severity = max((item["severity"] for item in categories), default=0)
    verdict = "Unsafe" if max_severity >= 3 else "Safe"

    return {
        "verdict": verdict,
        "safe": verdict == "Safe",
        "maxSeverity": max_severity,
        "threatScore": min(100, round((max_severity / 7) * 100)),
        "confidence": _confidence_from_categories(categories),
        "categories": categories,
        "raw": data,
        "apiVersion": API_VERSION,
    }


def test_connection(endpoint: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
    result = analyze_text("Azure AI Content Safety connection test.", endpoint, api_key)
    return {
        "status": "connected",
        "message": "Azure AI Content Safety is reachable and responding.",
        "apiVersion": result["apiVersion"],
    }


def _normalize_categories(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_category = {item.get("category"): item for item in items}
    normalized = []
    for category in CATEGORIES:
        severity = int(by_category.get(category, {}).get("severity", 0) or 0)
        normalized.append(
            {
                "category": category,
                "label": _label_for_category(category),
                "severity": severity,
                "risk": _risk_label(severity),
                "color": _risk_color(severity),
            }
        )
    return normalized


def _label_for_category(category: str) -> str:
    return {
        "Hate": "Hate",
        "SelfHarm": "Self-harm",
        "Sexual": "Sexual",
        "Violence": "Violence",
    }.get(category, category)


def _risk_label(severity: int) -> str:
    if severity == 0:
        return "None"
    if severity <= 2:
        return "Low"
    if severity <= 4:
        return "Medium"
    if severity <= 6:
        return "High"
    return "Critical"


def _risk_color(severity: int) -> str:
    if severity == 0:
        return "#22c55e"
    if severity <= 2:
        return "#38bdf8"
    if severity <= 4:
        return "#f59e0b"
    if severity <= 6:
        return "#f97316"
    return "#ef4444"


def _confidence_from_categories(categories: List[Dict[str, Any]]) -> int:
    max_severity = max((item["severity"] for item in categories), default=0)
    if max_severity == 0:
        return 94
    return min(99, 72 + (max_severity * 4))
