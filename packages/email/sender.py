from __future__ import annotations

"""
CueBI Email Service — sends scheduled report results and alert notifications.
Uses Resend (resend.com) — developer-friendly, 3000 free emails/month.

Setup: Set RESEND_API_KEY in .env
"""
import os
import json
import csv
import io
from typing import Any

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "reports@cuebi.in")


async def send_report_email(
    recipients: list[str],
    subject: str,
    body_text: str,
    attachment_data: str | bytes,
    attachment_filename: str = "report.csv",
    attachment_type: str = "text/csv",
) -> dict[str, Any]:
    """Send a scheduled report email with CSV/PDF attachment."""
    if not RESEND_API_KEY:
        return {"ok": False, "error": "RESEND_API_KEY not configured. Set it in .env to enable email."}

    import httpx
    import base64

    if isinstance(attachment_data, str):
        attachment_data = attachment_data.encode("utf-8")

    payload = {
        "from": FROM_EMAIL,
        "to": recipients,
        "subject": subject,
        "text": body_text,
        "attachments": [
            {
                "filename": attachment_filename,
                "content": base64.b64encode(attachment_data).decode("utf-8"),
                "type": attachment_type,
            }
        ],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

    if response.status_code in (200, 201):
        return {"ok": True, "id": response.json().get("id")}
    else:
        return {"ok": False, "error": response.text}


async def send_alert_email(
    recipients: list[str],
    alert_name: str,
    condition_text: str,
    current_value: float,
    threshold: float,
    question: str,
) -> dict[str, Any]:
    """Send an alert notification email."""
    if not RESEND_API_KEY:
        return {"ok": False, "error": "RESEND_API_KEY not configured"}

    import httpx

    subject = f"🔔 CueBI Alert: {alert_name}"
    body = (
        f"Alert: {alert_name}\n\n"
        f"Condition: {condition_text}\n"
        f"Current Value: ₹{current_value:,.2f}\n"
        f"Threshold: ₹{threshold:,.2f}\n\n"
        f"Query: {question}\n\n"
        f"—\nCueBI • CueBI System\n"
    )

    payload = {
        "from": FROM_EMAIL,
        "to": recipients,
        "subject": subject,
        "text": body,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

    if response.status_code in (200, 201):
        return {"ok": True, "id": response.json().get("id")}
    else:
        return {"ok": False, "error": response.text}


def query_result_to_csv(columns: list[str], rows: list[dict | list]) -> str:
    """Convert query results to CSV string for email attachment."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(columns)
    for row in rows:
        if isinstance(row, dict):
            writer.writerow([row.get(c, "") for c in columns])
        elif isinstance(row, (list, tuple)):
            writer.writerow(row)
    return output.getvalue()
