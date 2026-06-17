import os
import sys
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import boto3

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import get_current_user, CurrentUser
from auth.roles import ROLES
from mongo import db
from bson import ObjectId

router = APIRouter()

region = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "")

ses = None
s3 = None
_aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
if _aws_key and "your_" not in _aws_key:
    ses = boto3.client("ses", region_name=region)
    s3 = boto3.client("s3", region_name=region)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")


def check_permission(user: CurrentUser, required_permission: str):
    if user.role == "admin":
        return True
    user_perms = ROLES.get(user.role, {}).get("permissions", [])
    if "*" in user_perms or required_permission in user_perms:
        return True
    raise HTTPException(status_code=403, detail=f"Permission denied: {required_permission} required")


class GenerateReportRequest(BaseModel):
    report_type: str
    brand: str = "all"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    format: str = "html"


class ShareEmailRequest(BaseModel):
    report_id: str
    to_emails: List[str]
    personal_note: str = ""


class ShareLinkRequest(BaseModel):
    report_id: str
    expires_hours: int = 48


# ---------------------------------------------------------------------------
# Report HTML builder — pulls real data from MongoDB
# ---------------------------------------------------------------------------

def _build_report_html(report_type: str, brand: str, date_from: Optional[str], date_to: Optional[str]) -> str:
    brand_filter = {} if brand == "all" else {"brand": brand}

    date_filter = {}
    if date_from:
        try:
            date_filter["$gte"] = datetime.fromisoformat(date_from)
        except Exception:
            pass
    if date_to:
        try:
            date_filter["$lte"] = datetime.fromisoformat(date_to)
        except Exception:
            pass

    created_filter = {**brand_filter}
    if date_filter:
        created_filter["created_at"] = date_filter

    # Content library counts
    total_content = db.content_library.count_documents(created_filter)
    published     = db.content_library.count_documents({**created_filter, "status": "published"})
    pending       = db.content_library.count_documents({**created_filter, "status": "pending_review"})
    flagged       = db.content_library.count_documents({**created_filter, "status": "flagged"})
    briefs_count  = db.smo_briefs.count_documents(created_filter)

    # Engagement totals
    analytics_filter = {**brand_filter}
    if date_filter:
        analytics_filter["published_at"] = date_filter
    analytics_docs   = list(db.content_analytics.find(analytics_filter))
    total_engagement = sum(a.get("engagement", 0) for a in analytics_docs)
    total_saves      = sum(a.get("saves", 0) for a in analytics_docs)

    # Performance context (Agent 4)
    perf_ctx = db.agent1_brief_context.find_one(brand_filter, sort=[("week_start", -1)])

    # Top 5 published items by prescore
    top_items = list(
        db.content_library.find(
            {**created_filter, "status": "published", "ai_prescore": {"$ne": None}}
        ).sort("ai_prescore.score", -1).limit(5)
    )

    brand_label = brand.replace("_", " ").title() if brand != "all" else "All Brands"
    date_range  = f"{date_from or 'All time'} — {date_to or 'Present'}"

    top_rows = ""
    for item in top_items:
        score   = (item.get("ai_prescore") or {}).get("score", 0)
        caption = (item.get("caption") or item.get("content_body", ""))[:70]
        plat    = ", ".join(item.get("platform", []))
        top_rows += f"<tr><td>{caption}…</td><td>{item.get('format','')}</td><td>{plat}</td><td>{score}/100</td></tr>"

    top_table = ""
    if top_rows:
        top_table = f"""
        <h2>Top Performing Content</h2>
        <table>
          <tr><th>Content</th><th>Format</th><th>Platform</th><th>AI Score</th></tr>
          {top_rows}
        </table>"""

    perf_section = ""
    if perf_ctx:
        topics  = ", ".join(perf_ctx.get("top_topics",  [])[:3]) or "N/A"
        formats = ", ".join(perf_ctx.get("top_formats", [])[:3]) or "N/A"
        worst   = ", ".join(perf_ctx.get("worst_topics",[])[:2]) or "N/A"
        perf_section = f"""
        <h2>Performance Intelligence (Agent 4)</h2>
        <table>
          <tr><th>Top Topics</th><td>{topics}</td></tr>
          <tr><th>Top Formats</th><td>{formats}</td></tr>
          <tr><th>Topics to Avoid</th><td>{worst}</td></tr>
          <tr><th>Avg Engagement</th><td>{perf_ctx.get('avg_engagement', 0)}</td></tr>
          <tr><th>Posts Analysed</th><td>{perf_ctx.get('total_posts_analyzed', 0)}</td></tr>
        </table>"""

    return f"""
<style>
  body {{ font-family: system-ui, sans-serif; color: #111; max-width: 900px; margin: 0 auto; }}
  h1, h2 {{ color: #1a1a2e; }}
  .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }}
  .box {{ background: #f4f4f8; border-radius: 8px; padding: 16px; text-align: center; }}
  .box .val {{ font-size: 2rem; font-weight: bold; color: #1a1a2e; }}
  .box .lbl {{ font-size: 0.85rem; color: #555; }}
  table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
  th {{ background: #1a1a2e; color: #fff; padding: 8px 12px; text-align: left; }}
  td {{ padding: 8px 12px; border-bottom: 1px solid #eee; }}
  tr:nth-child(even) td {{ background: #f9f9fb; }}
</style>

<h1>{report_type.replace('_', ' ').title()} Report</h1>
<p><strong>Brand:</strong> {brand_label} &nbsp;|&nbsp; <strong>Period:</strong> {date_range}</p>

<h2>Content Summary</h2>
<div class="grid">
  <div class="box"><div class="val">{total_content}</div><div class="lbl">Total Items</div></div>
  <div class="box"><div class="val">{published}</div><div class="lbl">Published</div></div>
  <div class="box"><div class="val">{briefs_count}</div><div class="lbl">Briefs Generated</div></div>
  <div class="box"><div class="val">{pending}</div><div class="lbl">Pending Review</div></div>
  <div class="box"><div class="val">{flagged}</div><div class="lbl">Flagged</div></div>
  <div class="box"><div class="val">{total_engagement}</div><div class="lbl">Total Engagement</div></div>
</div>

{top_table}
{perf_section}
"""


# ---------------------------------------------------------------------------
# PDF generation — weasyprint if available, else skip
# ---------------------------------------------------------------------------

def _generate_pdf(html_content: str) -> Optional[bytes]:
    try:
        from weasyprint import HTML
        return HTML(string=html_content).write_pdf()
    except Exception:
        return None


def _upload_pdf_to_s3(pdf_bytes: bytes, report_id: str) -> Optional[str]:
    if not s3 or not S3_BUCKET:
        return None
    try:
        key = f"reports/{report_id}.pdf"
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        return f"s3://{S3_BUCKET}/{key}"
    except Exception as e:
        print(f"S3 upload failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Email sending — SES first, SMTP fallback
# ---------------------------------------------------------------------------

def _send_email(to_emails: List[str], subject: str, html_body: str):
    if ses:
        ses.send_email(
            Source="reports@harshwal.com",
            Destination={"ToAddresses": to_emails},
            Message={"Subject": {"Data": subject}, "Body": {"Html": {"Data": html_body}}},
        )
        return

    if SMTP_HOST and SMTP_USER and SMTP_PASS:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_USER
        msg["To"]      = ", ".join(to_emails)
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_USER, to_emails, msg.as_string())
        return

    # Neither SES nor SMTP configured — log clearly
    print(f"[EMAIL] No mail provider configured. Would have sent to {to_emails}: {subject}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/api/reports/generate")
async def generate_report(req: GenerateReportRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")

    html_content = _build_report_html(req.report_type, req.brand, req.date_from, req.date_to)

    # Attempt PDF generation and S3 upload
    pdf_s3_path = None
    if req.format in ("pdf", "both"):
        pdf_bytes = _generate_pdf(html_content)
        if pdf_bytes:
            temp_id = secrets.token_hex(8)
            pdf_s3_path = _upload_pdf_to_s3(pdf_bytes, temp_id)

    report_doc = {
        "type":          req.report_type,
        "brand":         req.brand,
        "date_from":     req.date_from,
        "date_to":       req.date_to,
        "format":        req.format,
        "html_content":  html_content,
        "pdf_s3_path":   pdf_s3_path,
        "generated_at":  datetime.utcnow().isoformat(),
        "generated_by":  current_user.id,
        "status":        "completed",
    }

    result = db.reports.insert_one(report_doc)
    return {"status": "generated", "report_id": str(result.inserted_id), "pdf_available": pdf_s3_path is not None}


@router.get("/api/reports/recent")
async def get_recent_reports(current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")

    reports = list(db.reports.find().sort("generated_at", -1).limit(20))
    for r in reports:
        r["_id"] = str(r["_id"])
    return reports


@router.post("/api/reports/share/email")
async def share_via_email(req: ShareEmailRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")

    try:
        obj_id = ObjectId(req.report_id)
    except Exception:
        raise HTTPException(400, "Invalid report ID")

    report = db.reports.find_one({"_id": obj_id})
    if not report:
        raise HTTPException(404, "Report not found")

    html_body = f"""
    <h2>Harshwal {report.get('type', '')} Report</h2>
    <p>{req.personal_note}</p>
    <hr/>
    {report.get('html_content', '')}
    """

    try:
        _send_email(
            to_emails=req.to_emails,
            subject=f"Harshwal Report: {report.get('type', 'Custom')}",
            html_body=html_body,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {e}")

    db.report_shares.insert_one({
        "report_id":  req.report_id,
        "method":     "email",
        "recipients": req.to_emails,
        "shared_by":  current_user.id,
        "shared_at":  datetime.utcnow().isoformat(),
    })

    return {"status": "sent", "recipients": len(req.to_emails)}


@router.post("/api/reports/share/link")
async def generate_share_link(req: ShareLinkRequest, current_user: CurrentUser = Depends(get_current_user)):
    check_permission(current_user, "analytics:read")

    token      = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=req.expires_hours)

    db.report_shares.insert_one({
        "token":          token,
        "report_id":      req.report_id,
        "method":         "link",
        "created_by":     current_user.id,
        "created_at":     datetime.utcnow().isoformat(),
        "expires_at":     expires_at.isoformat(),
        "accessed_count": 0,
    })

    base_url  = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3000")
    share_url = f"{base_url}/report/{token}"

    return {"url": share_url, "expires_at": expires_at.isoformat()}


@router.get("/report/{token}")
async def view_shared_report(token: str):
    """PUBLIC ENDPOINT — no authentication required."""
    share = db.report_shares.find_one({"token": token, "method": "link"})

    if not share:
        raise HTTPException(404, "Report link not found")

    if datetime.utcnow() > datetime.fromisoformat(share["expires_at"]):
        raise HTTPException(410, "This report link has expired")

    db.report_shares.update_one(
        {"token": token},
        {"$inc": {"accessed_count": 1}, "$set": {"last_accessed": datetime.utcnow().isoformat()}},
    )

    try:
        report = db.reports.find_one({"_id": ObjectId(share["report_id"])})
    except Exception:
        raise HTTPException(400, "Invalid report reference")

    if not report:
        raise HTTPException(404, "Report content not found")

    html = f"""
    <html>
    <head>
        <title>Harshwal Report</title>
        <style>
            body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #111; }}
            .header {{ border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Harshwal Confidential Report</h2>
            <p>Type: {report.get('type', 'N/A')} | Generated: {report.get('generated_at', '')[:10]}</p>
        </div>
        <div class="content">
            {report.get('html_content', '')}
        </div>
        <div class="footer">
            Generated by Harshwal Agentic Automation. Link expires {share['expires_at'][:10]}.
        </div>
    </body>
    </html>
    """

    return HTMLResponse(content=html)
