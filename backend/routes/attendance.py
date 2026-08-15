"""Attendance history + reports + CSV/PDF export."""
import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, Response
from bson import ObjectId

from db import get_db
from deps import get_current_user, require_admin

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _fmt_ts(v):
    return v if isinstance(v, str) else v.isoformat()


def _shape(r: dict, employee_name: str = "", office_name: str = "") -> dict:
    return {
        "id": str(r["_id"]),
        "org_id": r["org_id"],
        "user_id": r["user_id"],
        "office_id": r["office_id"],
        "employee_name": employee_name,
        "office_name": office_name,
        "started_at": r["started_at"],
        "ended_at": r["ended_at"],
        "outcome": r["outcome"],
        "total_inside_ms": r.get("total_inside_ms", 0),
        "bout_count": r.get("bout_count", 0),
        "flagged": r.get("flagged", False),
        "record_hash": r.get("record_hash", ""),
        "prev_record_hash": r.get("prev_record_hash", ""),
    }


async def _resolve_query(db, org_id: str, user_id: str | None, office_id: str | None, start: str | None, end: str | None, own_only_user_id: str | None):
    q = {"org_id": org_id}
    if own_only_user_id:
        q["user_id"] = own_only_user_id
    elif user_id:
        q["user_id"] = user_id
    if office_id:
        q["office_id"] = office_id
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        q["ended_at"] = rng
    return q


@router.get("/records")
async def list_records(
    user: dict = Depends(get_current_user),
    user_id: str | None = Query(None),
    office_id: str | None = Query(None),
    start: str | None = Query(None),
    end: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    db = get_db()
    own = user["id"] if user["role"] == "employee" else None
    q = await _resolve_query(db, user["org_id"], user_id, office_id, start, end, own)
    cur = db.attendance_records.find(q).sort("ended_at", -1).limit(limit)
    records = [r async for r in cur]

    # Batch lookup names
    emp_ids = list({r["user_id"] for r in records})
    off_ids = list({r["office_id"] for r in records if r.get("office_id")})
    emp_map, off_map = {}, {}
    if emp_ids:
        async for u in db.users.find({"_id": {"$in": [ObjectId(x) for x in emp_ids]}}):
            emp_map[str(u["_id"])] = u["name"]
    if off_ids:
        async for o in db.offices.find({"_id": {"$in": [ObjectId(x) for x in off_ids]}}):
            off_map[str(o["_id"])] = o["name"]
    return [_shape(r, emp_map.get(r["user_id"], ""), off_map.get(r["office_id"], "")) for r in records]


@router.get("/export.csv")
async def export_csv(
    user: dict = Depends(require_admin),
    user_id: str | None = Query(None),
    office_id: str | None = Query(None),
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    db = get_db()
    q = await _resolve_query(db, user["org_id"], user_id, office_id, start, end, None)
    cur = db.attendance_records.find(q).sort("ended_at", -1)
    records = [r async for r in cur]
    emp_ids = list({r["user_id"] for r in records})
    off_ids = list({r["office_id"] for r in records if r.get("office_id")})
    emp_map, off_map = {}, {}
    if emp_ids:
        async for u in db.users.find({"_id": {"$in": [ObjectId(x) for x in emp_ids]}}):
            emp_map[str(u["_id"])] = u["name"]
    if off_ids:
        async for o in db.offices.find({"_id": {"$in": [ObjectId(x) for x in off_ids]}}):
            off_map[str(o["_id"])] = o["name"]

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["employee", "office", "started_at", "ended_at", "outcome", "total_inside_minutes", "bout_count", "flagged", "record_hash"])
    for r in records:
        w.writerow([
            emp_map.get(r["user_id"], ""),
            off_map.get(r["office_id"], ""),
            r["started_at"],
            r["ended_at"],
            r["outcome"],
            round(r.get("total_inside_ms", 0) / 60000, 2),
            r.get("bout_count", 0),
            "yes" if r.get("flagged") else "no",
            r.get("record_hash", "")[:16],
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"},
    )


@router.get("/export.pdf")
async def export_pdf(
    user: dict = Depends(require_admin),
    user_id: str | None = Query(None),
    office_id: str | None = Query(None),
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors

    db = get_db()
    q = await _resolve_query(db, user["org_id"], user_id, office_id, start, end, None)
    cur = db.attendance_records.find(q).sort("ended_at", -1).limit(500)
    records = [r async for r in cur]
    emp_ids = list({r["user_id"] for r in records})
    off_ids = list({r["office_id"] for r in records if r.get("office_id")})
    emp_map, off_map = {}, {}
    if emp_ids:
        async for u in db.users.find({"_id": {"$in": [ObjectId(x) for x in emp_ids]}}):
            emp_map[str(u["_id"])] = u["name"]
    if off_ids:
        async for o in db.offices.find({"_id": {"$in": [ObjectId(x) for x in off_ids]}}):
            off_map[str(o["_id"])] = o["name"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    story = [Paragraph("<b>StayPin — Attendance Report</b>", styles["Title"]), Spacer(1, 12)]
    story.append(Paragraph(f"Generated {datetime.now(timezone.utc).isoformat()}", styles["Normal"]))
    story.append(Spacer(1, 12))
    data = [["Employee", "Office", "Started", "Ended", "Outcome", "Minutes", "Bouts", "Flagged"]]
    for r in records:
        data.append([
            emp_map.get(r["user_id"], ""),
            off_map.get(r["office_id"], ""),
            r["started_at"][:19],
            r["ended_at"][:19],
            r["outcome"],
            f"{round(r.get('total_inside_ms', 0)/60000, 1)}",
            str(r.get("bout_count", 0)),
            "yes" if r.get("flagged") else "no",
        ])
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A1A1A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.whitesmoke),
    ]))
    story.append(t)
    doc.build(story)
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=attendance_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"},
    )


@router.get("/summary")
async def summary(user: dict = Depends(require_admin)):
    """Aggregated stats for admin dashboard."""
    db = get_db()
    total_offices = await db.offices.count_documents({"org_id": user["org_id"]})
    total_employees = await db.users.count_documents({"org_id": user["org_id"], "role": "employee", "deleted_at": None})
    active_sessions = await db.active_sessions.count_documents({"org_id": user["org_id"], "status": "active"})
    paused_sessions = await db.active_sessions.count_documents({"org_id": user["org_id"], "status": "paused"})
    total_records = await db.attendance_records.count_documents({"org_id": user["org_id"]})
    flagged_records = await db.attendance_records.count_documents({"org_id": user["org_id"], "flagged": True})
    return {
        "total_offices": total_offices,
        "total_employees": total_employees,
        "active_sessions": active_sessions,
        "paused_sessions": paused_sessions,
        "total_records": total_records,
        "flagged_records": flagged_records,
    }
