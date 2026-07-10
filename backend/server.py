from fastapi import FastAPI, APIRouter, Request, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import json
import logging
import uuid
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Pre-seeded admin emails
ADMIN_EMAILS = {
    "sonawaneharshad1999@gmail.com",
    "samraj.borade@gmail.com",
}

# ---------- Firebase Admin init ----------
# Provide credentials via FIREBASE_SERVICE_ACCOUNT_JSON (the full JSON as a
# string, set as a single env var on Cloud Run / Render), OR set
# GOOGLE_APPLICATION_CREDENTIALS to a file path if running somewhere that
# supports mounting files.
_firebase_creds_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
if _firebase_creds_json:
    _cred = credentials.Certificate(json.loads(_firebase_creds_json))
    firebase_admin.initialize_app(_cred)
else:
    # Falls back to GOOGLE_APPLICATION_CREDENTIALS env var or default
    # credentials (works automatically on Cloud Run if using a GCP project).
    firebase_admin.initialize_app()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------- Models ----------
class UserPublic(BaseModel):
    user_id: str
    name: str
    email: str
    picture: Optional[str] = None
    role: Literal["admin", "volunteer"] = "volunteer"
    active: bool = True
    created_at: datetime


class SessionRequest(BaseModel):
    id_token: str  # Firebase ID token from the client's Google sign-in


class SessionResponse(BaseModel):
    session_token: str
    user: UserPublic


class RoleUpdate(BaseModel):
    role: Literal["admin", "volunteer"]


class ActiveUpdate(BaseModel):
    active: bool


class CollectionCreate(BaseModel):
    donor_name: str
    donor_phone: str
    amount: float
    payment_mode: Literal["cash", "upi"]
    address: Optional[str] = ""
    notes: Optional[str] = ""
    client_temp_id: Optional[str] = None  # for offline dedupe


class CollectionOut(BaseModel):
    id: str
    receipt_no: str
    donor_name: str
    donor_phone: str
    amount: float
    payment_mode: str
    address: str
    notes: str
    collector_id: str
    collector_name: str
    created_at: datetime
    status: str = "active"


# ---------- Helpers ----------
def to_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def upsert_user_from_firebase(decoded: dict) -> dict:
    """Given a decoded Firebase ID token, create/update the local user doc
    and return it. This is the single source of truth for provisioning
    users, called both on explicit login and on every authenticated
    request (so a user created via Google sign-in always has a doc)."""
    email = decoded.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")
    name = decoded.get("name") or email.split("@")[0]
    picture = decoded.get("picture")
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        update = {"name": name, "picture": picture}
        if email in ADMIN_EMAILS and existing.get("role") != "admin":
            update["role"] = "admin"
        await db.users.update_one({"user_id": user_id}, {"$set": update})
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email in ADMIN_EMAILS else "volunteer"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "active": True,
            "created_at": now,
        }
        await db.users.insert_one(dict(user))
        user.pop("_id", None)
    return user


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1].strip()
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await upsert_user_from_firebase(decoded)
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    return user


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def next_receipt_no() -> str:
    year = datetime.now(timezone.utc).year
    key = f"receipt-{year}"
    doc = await db.counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc["seq"] if doc and "seq" in doc else 1
    return f"JBM-{year}-{seq:04d}"


# ---------- Auth ----------
# The client signs in with Google via Firebase Auth on-device, gets a
# Firebase ID token, and calls this once right after login so we can
# provision/update the local user doc and hand back app-level role info.
# The SAME Firebase ID token is then used as the Bearer token on every
# subsequent request (Firebase's SDK auto-refreshes it client-side; we
# verify it fresh on every request in get_current_user, so there is no
# separate server-side session table to manage or expire).
@api_router.post("/auth/session", response_model=SessionResponse)
async def auth_session(payload: SessionRequest):
    try:
        decoded = firebase_auth.verify_id_token(payload.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token")
    user = await upsert_user_from_firebase(decoded)
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    return {
        "session_token": payload.id_token,
        "user": UserPublic(**user),
    }


@api_router.get("/auth/me", response_model=UserPublic)
async def auth_me(request: Request):
    user = await get_current_user(request)
    return UserPublic(**user)


@api_router.post("/auth/logout")
async def auth_logout(request: Request):
    # Nothing to invalidate server-side; the client just discards the
    # Firebase ID token and signs out of Firebase Auth locally.
    return {"ok": True}


# ---------- Users (Admin) ----------
@api_router.get("/users", response_model=List[UserPublic])
async def list_users(request: Request):
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [UserPublic(**u) for u in users]


@api_router.patch("/users/{user_id}/role", response_model=UserPublic)
async def update_role(user_id: str, payload: RoleUpdate, request: Request):
    admin = await require_admin(request)
    if admin["user_id"] == user_id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    await db.users.update_one(
        {"user_id": user_id}, {"$set": {"role": payload.role}}
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**user)


@api_router.patch("/users/{user_id}/active", response_model=UserPublic)
async def update_active(user_id: str, payload: ActiveUpdate, request: Request):
    admin = await require_admin(request)
    if admin["user_id"] == user_id and not payload.active:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    await db.users.update_one(
        {"user_id": user_id}, {"$set": {"active": payload.active}}
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**user)


# ---------- Collections ----------
def _to_out(doc: dict) -> CollectionOut:
    return CollectionOut(
        id=doc["id"],
        receipt_no=doc["receipt_no"],
        donor_name=doc["donor_name"],
        donor_phone=doc["donor_phone"],
        amount=doc["amount"],
        payment_mode=doc["payment_mode"],
        address=doc.get("address", ""),
        notes=doc.get("notes", ""),
        collector_id=doc["collector_id"],
        collector_name=doc["collector_name"],
        created_at=doc["created_at"],
        status=doc.get("status", "active"),
    )


@api_router.post("/collections", response_model=CollectionOut)
async def create_collection(payload: CollectionCreate, request: Request):
    user = await get_current_user(request)

    # Offline dedupe: return existing if client_temp_id already synced
    if payload.client_temp_id:
        prev = await db.collections.find_one(
            {"client_temp_id": payload.client_temp_id, "collector_id": user["user_id"]},
            {"_id": 0},
        )
        if prev:
            return _to_out(prev)

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
    if not payload.donor_name.strip():
        raise HTTPException(status_code=400, detail="Donor name required")
    if not payload.donor_phone.isdigit() or len(payload.donor_phone) != 10:
        raise HTTPException(status_code=400, detail="Phone must be 10 digits")

    receipt_no = await next_receipt_no()
    doc = {
        "id": str(uuid.uuid4()),
        "receipt_no": receipt_no,
        "donor_name": payload.donor_name.strip(),
        "donor_phone": payload.donor_phone.strip(),
        "amount": float(payload.amount),
        "payment_mode": payload.payment_mode,
        "address": (payload.address or "").strip(),
        "notes": (payload.notes or "").strip(),
        "collector_id": user["user_id"],
        "collector_name": user["name"],
        "client_temp_id": payload.client_temp_id,
        "created_at": datetime.now(timezone.utc),
        "status": "active",
    }
    await db.collections.insert_one(dict(doc))
    doc.pop("_id", None)
    return _to_out(doc)


def _build_filter(
    user: dict,
    start: Optional[str],
    end: Optional[str],
    volunteer_id: Optional[str],
    payment_mode: Optional[str],
    search: Optional[str],
) -> dict:
    q: dict = {"status": "active"}
    if user["role"] != "admin":
        q["collector_id"] = user["user_id"]
    elif volunteer_id:
        q["collector_id"] = volunteer_id
    if payment_mode in ("cash", "upi"):
        q["payment_mode"] = payment_mode
    date_q: dict = {}
    if start:
        try:
            date_q["$gte"] = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except Exception:
            pass
    if end:
        try:
            date_q["$lte"] = datetime.fromisoformat(end.replace("Z", "+00:00"))
        except Exception:
            pass
    if date_q:
        q["created_at"] = date_q
    if search:
        q["$or"] = [
            {"donor_name": {"$regex": search, "$options": "i"}},
            {"donor_phone": {"$regex": search, "$options": "i"}},
            {"receipt_no": {"$regex": search, "$options": "i"}},
        ]
    return q


@api_router.get("/collections", response_model=List[CollectionOut])
async def list_collections(
    request: Request,
    start: Optional[str] = None,
    end: Optional[str] = None,
    volunteer_id: Optional[str] = None,
    payment_mode: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(500, le=2000),
):
    user = await get_current_user(request)
    q = _build_filter(user, start, end, volunteer_id, payment_mode, search)
    docs = (
        await db.collections.find(q, {"_id": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return [_to_out(d) for d in docs]


@api_router.get("/collections/export.csv")
async def export_csv(
    request: Request,
    start: Optional[str] = None,
    end: Optional[str] = None,
    volunteer_id: Optional[str] = None,
    payment_mode: Optional[str] = None,
    search: Optional[str] = None,
):
    await require_admin(request)
    user = await get_current_user(request)
    q = _build_filter(user, start, end, volunteer_id, payment_mode, search)
    docs = (
        await db.collections.find(q, {"_id": 0})
        .sort("created_at", 1)  # ascending for readable ledger
        .to_list(10000)
    )
    buf = io.StringIO()
    writer = csv.writer(buf)

    # --- Header block: mandal + ganpati + export meta ---
    now = datetime.now(timezone.utc)
    writer.writerow(["Jai Bharat Mitra Mandal"])
    writer.writerow(["Ganpati", "NITYANAND NAGAR CHA GANRAJ"])
    writer.writerow(["Tagline", "उत्सवातून संस्कृतीकडे"])
    writer.writerow(["Export Generated At", now.isoformat()])
    writer.writerow(["Exported By", user["name"]])
    filters_desc = []
    if start:
        filters_desc.append(f"from={start}")
    if end:
        filters_desc.append(f"to={end}")
    if payment_mode:
        filters_desc.append(f"mode={payment_mode}")
    if volunteer_id:
        filters_desc.append(f"volunteer_id={volunteer_id}")
    if search:
        filters_desc.append(f"search={search}")
    writer.writerow(["Filters", ", ".join(filters_desc) if filters_desc else "None"])
    writer.writerow([])

    # --- Ledger table ---
    writer.writerow(
        [
            "S.No",
            "Receipt No",
            "Date",
            "Time",
            "Donor Name",
            "WhatsApp",
            "Amount (INR)",
            "Payment Mode",
            "Address / Shop",
            "Notes",
            "Collector",
            "Running Total (INR)",
        ]
    )
    running = 0.0
    total_cash = 0.0
    total_upi = 0.0
    count_cash = 0
    count_upi = 0
    collectors: dict = {}
    for i, d in enumerate(docs, start=1):
        amt = float(d["amount"])
        running += amt
        dt = to_aware(d["created_at"])
        mode = d["payment_mode"]
        if mode == "cash":
            total_cash += amt
            count_cash += 1
        elif mode == "upi":
            total_upi += amt
            count_upi += 1
        c = collectors.setdefault(
            d["collector_name"], {"total": 0.0, "count": 0}
        )
        c["total"] += amt
        c["count"] += 1
        writer.writerow(
            [
                i,
                d["receipt_no"],
                dt.strftime("%d-%b-%Y"),
                dt.strftime("%H:%M"),
                d["donor_name"],
                f"+91 {d['donor_phone']}",
                f"{amt:.2f}",
                mode.upper(),
                d.get("address", ""),
                d.get("notes", ""),
                d["collector_name"],
                f"{running:.2f}",
            ]
        )

    # --- Summary footer ---
    writer.writerow([])
    writer.writerow(["SUMMARY"])
    writer.writerow(["Total Receipts", len(docs)])
    writer.writerow(["Grand Total (INR)", f"{running:.2f}"])
    writer.writerow(["Cash Total (INR)", f"{total_cash:.2f}", "Receipts", count_cash])
    writer.writerow(["UPI Total (INR)", f"{total_upi:.2f}", "Receipts", count_upi])

    if collectors:
        writer.writerow([])
        writer.writerow(["COLLECTOR-WISE TALLY"])
        writer.writerow(["Collector", "Receipts", "Total (INR)"])
        for name, agg in sorted(
            collectors.items(), key=lambda kv: kv[1]["total"], reverse=True
        ):
            writer.writerow([name, agg["count"], f"{agg['total']:.2f}"])

    buf.seek(0)
    filename = f"jbm_collections_{now.strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/collections/{cid}", response_model=CollectionOut)
async def get_collection(cid: str, request: Request):
    user = await get_current_user(request)
    doc = await db.collections.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if user["role"] != "admin" and doc["collector_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return _to_out(doc)


# ---------- Dashboard ----------
@api_router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    start_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    start_week = start_today - timedelta(days=start_today.weekday())

    base_match: dict = {"status": "active"}
    if user["role"] != "admin":
        base_match["collector_id"] = user["user_id"]

    async def sum_amount(match: dict):
        pipeline = [
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
        res = await db.collections.aggregate(pipeline).to_list(1)
        return (res[0]["total"], res[0]["count"]) if res else (0.0, 0)

    total_amt, total_cnt = await sum_amount(base_match)
    today_amt, today_cnt = await sum_amount(
        {**base_match, "created_at": {"$gte": start_today}}
    )
    week_amt, week_cnt = await sum_amount(
        {**base_match, "created_at": {"$gte": start_week}}
    )

    # by payment mode
    mode_pipeline = [
        {"$match": base_match},
        {
            "$group": {
                "_id": "$payment_mode",
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
    ]
    modes = await db.collections.aggregate(mode_pipeline).to_list(10)
    by_mode = {m["_id"]: {"total": m["total"], "count": m["count"]} for m in modes}
    # leaderboard
    leaderboard = []
    if user["role"] == "admin":
        lb_pipeline = [
            {"$match": base_match},
            {
                "$group": {
                    "_id": "$collector_id",
                    "name": {"$first": "$collector_name"},
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"total": -1}},
        ]
        lb = await db.collections.aggregate(lb_pipeline).to_list(100)
        for row in lb:
            leaderboard.append(
                {
                    "user_id": row["_id"],
                    "name": row["name"],
                    "total": row["total"],
                    "count": row["count"],
                }
            )

    return {
        "total": {"amount": total_amt, "count": total_cnt},
        "today": {"amount": today_amt, "count": today_cnt},
        "week": {"amount": week_amt, "count": week_cnt},
        "by_mode": {
            "cash": by_mode.get("cash", {"total": 0, "count": 0}),
            "upi": by_mode.get("upi", {"total": 0, "count": 0}),
        },
        "leaderboard": leaderboard,
    }


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.collections.create_index("id", unique=True)
    await db.collections.create_index("collector_id")
    await db.collections.create_index("created_at")
    await db.collections.create_index("receipt_no", unique=True)
    await db.collections.create_index(
        [("client_temp_id", 1), ("collector_id", 1)], sparse=True
    )
    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@api_router.get("/health")
async def health():
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
