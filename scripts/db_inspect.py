#!/usr/bin/env python3
"""Ad-hoc database inspector for the Geofence Console.

Usage:
    python3 /app/scripts/db_inspect.py                     # summary of everything
    python3 /app/scripts/db_inspect.py orgs
    python3 /app/scripts/db_inspect.py users
    python3 /app/scripts/db_inspect.py offices
    python3 /app/scripts/db_inspect.py sessions            # active sessions
    python3 /app/scripts/db_inspect.py attendance [N=10]   # last N records
    python3 /app/scripts/db_inspect.py time-off
    python3 /app/scripts/db_inspect.py audit  [N=20]
    python3 /app/scripts/db_inspect.py security [N=20]
    python3 /app/scripts/db_inspect.py raw <collection> [N=10]   # any collection
"""
import sys, os, json
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME",  "geofence_console")

db = MongoClient(MONGO_URL)[DB_NAME]

def pretty(v):
    from bson import ObjectId
    from datetime import datetime
    if isinstance(v, ObjectId): return str(v)
    if isinstance(v, datetime): return v.isoformat()
    return v

def show(rows, keys=None):
    for r in rows:
        if keys:
            print("  " + "  ".join(f"{k}={pretty(r.get(k))}" for k in keys))
        else:
            print("  " + json.dumps({k: pretty(v) for k, v in r.items() if k != "password_hash"}, default=str)[:220])

def orgs():
    print("Organizations:")
    show(db.organizations.find({}, {"name":1,"slug":1,"plan":1,"created_at":1}), ["name","slug","plan","created_at"])

def users():
    print("Users:")
    for u in db.users.find({}, {"email":1,"name":1,"role":1,"org_id":1,"office_id":1,"schedule.mode":1,"last_login_at":1}):
        sch = (u.get("schedule") or {}).get("mode", "—")
        print(f"  {u['email']:32}  role={u['role']:10}  sched={sch}  org_id={u.get('org_id','')[:8]}  last_login={u.get('last_login_at','—')}")

def offices():
    print("Offices:")
    for o in db.offices.find({}):
        coords = o.get("location",{}).get("coordinates",[None,None])
        print(f"  {o.get('name'):30}  {coords[1]},{coords[0]}  r={o.get('radius_meters')}m  org={o.get('org_id','')[:8]}")

def sessions():
    print("Active sessions:")
    for s in db.active_sessions.find({}):
        print(f"  user={s.get('user_id','')[:8]}  status={s.get('status')}  remaining_ms={s.get('remaining_ms')}  bouts={s.get('bout_count')}")

def attendance(n=10):
    print(f"Last {n} attendance records:")
    for r in db.attendance_records.find({}).sort("ended_at",-1).limit(int(n)):
        mins = int(r.get("total_inside_ms",0)/60000)
        print(f"  {r.get('started_at','')[:19]} → {r.get('ended_at','')[:19]}  outcome={r.get('outcome'):10}  inside={mins}m  hash={r.get('record_hash','')[:10]}…")

def time_off():
    print("Time-off requests:")
    for t in db.time_off_requests.find({}).sort("created_at",-1):
        print(f"  [{t.get('status'):8}] {t.get('start_date')} → {t.get('end_date')}  {t.get('employee_name',''):20}  {t.get('reason','')[:60]}")

def audit(n=20):
    print(f"Last {n} admin actions:")
    for a in db.admin_audit_log.find({}).sort("ts",-1).limit(int(n)):
        print(f"  {a.get('ts','')[:19]}  {a.get('action'):25}  target={a.get('target_type')}/{a.get('target_id','')[:8]}  ip={a.get('ip','')}")

def security(n=20):
    print(f"Last {n} security events:")
    for a in db.security_events.find({}).sort("ts",-1).limit(int(n)):
        print(f"  {a.get('ts','')[:19]}  [{a.get('severity'):6}] {a.get('type'):22}  ip={a.get('ip','')}  {json.dumps(a.get('details',{}),default=str)[:80]}")

def raw(coll, n=10):
    print(f"{coll} (last {n}):")
    show(db[coll].find({}).limit(int(n)))

def summary():
    print(f"MongoDB @ {MONGO_URL} / {DB_NAME}")
    print("-" * 60)
    for c in sorted(db.list_collection_names()):
        print(f"  {c:28}  {db[c].estimated_document_count():>6} docs")
    print()
    orgs(); print(); users(); print(); offices()

cmd = sys.argv[1] if len(sys.argv) > 1 else "summary"
args = sys.argv[2:]
fn = {"summary":summary,"orgs":orgs,"users":users,"offices":offices,"sessions":sessions,
      "attendance":attendance,"time-off":time_off,"audit":audit,"security":security,"raw":raw}.get(cmd)
if not fn:
    print(__doc__); sys.exit(1)
fn(*args)
