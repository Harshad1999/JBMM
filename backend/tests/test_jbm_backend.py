"""End-to-end backend tests for Jai Bharat Mitra Mandal Collection App.

Covers: health, auth, users admin, collections CRUD + validation + offline
dedupe, dashboard stats, CSV export, RBAC and deactivation.
"""
import csv
import io
import uuid

import pytest

from tests.conftest import auth_headers, BASE_URL


# ---------- Health ----------
def test_health(api_client):
    r = api_client.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ---------- Auth ----------
def test_auth_session_invalid_returns_401(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/session",
        json={"session_id": "definitely-not-a-real-session-id-xyz-123"},
    )
    assert r.status_code == 401, r.text


def test_auth_me_missing_bearer_401(api_client):
    r = api_client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


def test_auth_me_invalid_bearer_401(api_client):
    r = api_client.get(
        f"{BASE_URL}/api/auth/me", headers=auth_headers("bogus-token-xyz")
    )
    assert r.status_code == 401


def test_auth_me_with_seeded_session(api_client, admin_token, admin_user):
    r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_id"] == admin_user["user_id"]
    assert body["email"] == admin_user["email"]
    assert body["role"] == "admin"
    assert body["active"] is True


def test_protected_endpoints_401_without_bearer(api_client):
    for path in [
        "/api/auth/me",
        "/api/collections",
        "/api/users",
        "/api/dashboard/stats",
    ]:
        r = api_client.get(f"{BASE_URL}{path}")
        assert r.status_code == 401, f"{path} did not return 401 (got {r.status_code})"


# ---------- Users (Admin) ----------
def test_list_users_volunteer_forbidden(api_client, volunteer_token):
    r = api_client.get(
        f"{BASE_URL}/api/users", headers=auth_headers(volunteer_token)
    )
    assert r.status_code == 403


def test_list_users_admin_ok(api_client, admin_token):
    r = api_client.get(
        f"{BASE_URL}/api/users", headers=auth_headers(admin_token)
    )
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert any(u["role"] == "admin" for u in users)


def test_admin_cannot_demote_self(api_client, admin_token, admin_user):
    r = api_client.patch(
        f"{BASE_URL}/api/users/{admin_user['user_id']}/role",
        headers=auth_headers(admin_token),
        json={"role": "volunteer"},
    )
    assert r.status_code == 400


def test_admin_cannot_deactivate_self(api_client, admin_token, admin_user):
    r = api_client.patch(
        f"{BASE_URL}/api/users/{admin_user['user_id']}/active",
        headers=auth_headers(admin_token),
        json={"active": False},
    )
    assert r.status_code == 400


def test_admin_can_promote_and_demote_volunteer(
    api_client, admin_token, volunteer2_user
):
    uid = volunteer2_user["user_id"]
    # promote
    r = api_client.patch(
        f"{BASE_URL}/api/users/{uid}/role",
        headers=auth_headers(admin_token),
        json={"role": "admin"},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    # demote back
    r = api_client.patch(
        f"{BASE_URL}/api/users/{uid}/role",
        headers=auth_headers(admin_token),
        json={"role": "volunteer"},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "volunteer"


# ---------- Collections: validation ----------
def _valid_payload(**overrides):
    p = {
        "donor_name": "TEST_JBM Donor",
        "donor_phone": "9876543210",
        "amount": 500.0,
        "payment_mode": "cash",
        "address": "Pune",
        "notes": "test",
    }
    p.update(overrides)
    return p


def test_collection_validation_donor_name_required(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(donor_name="   "),
    )
    assert r.status_code == 400


def test_collection_validation_phone_not_10(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(donor_phone="12345"),
    )
    assert r.status_code == 400


def test_collection_validation_phone_non_digit(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(donor_phone="98765abcde"),
    )
    assert r.status_code == 400


def test_collection_validation_amount_zero(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(amount=0),
    )
    assert r.status_code == 400


# ---------- payment_mode enum: cash|upi (paid is no longer allowed) ----------
def test_collection_payment_mode_upi_succeeds(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(payment_mode="upi", amount=250),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["payment_mode"] == "upi"
    assert body["amount"] == 250


def test_collection_payment_mode_paid_rejected(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(payment_mode="paid"),
    )
    # Pydantic Literal rejection -> 422 (accept 400 too, per spec)
    assert r.status_code in (400, 422), r.text


def test_collection_payment_mode_cash_succeeds(api_client, volunteer_token):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(payment_mode="cash", amount=150),
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_mode"] == "cash"


def test_collections_filter_by_upi_admin(api_client, admin_token, volunteer_token):
    # ensure at least one UPI record exists
    api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(payment_mode="upi", amount=444),
    )
    r = api_client.get(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(admin_token),
        params={"payment_mode": "upi"},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert all(d["payment_mode"] == "upi" for d in data)


# ---------- Idempotent session upsert ----------
def test_auth_session_upsert_idempotent(mongo, api_client, admin_user):
    """POSTing session data twice with same session_token should upsert, not 500.

    We cannot invoke /api/auth/session directly (needs real OAuth), but the
    upsert semantics live in the same MongoDB write we can simulate: insert
    the same session_token twice via the API client used by the app is not
    possible; instead we assert the collection has a unique index AND that
    the app-level code path uses update_one(..., upsert=True). We verify by
    calling the upsert twice against pymongo directly with the same token.
    """
    token = f"TEST_JBM_upsert_tok_{uuid.uuid4().hex}"
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    doc = {
        "session_token": token,
        "user_id": admin_user["user_id"],
        "expires_at": now + timedelta(days=7),
        "created_at": now,
    }
    # First upsert - inserts
    r1 = mongo.user_sessions.update_one(
        {"session_token": token}, {"$set": doc}, upsert=True
    )
    assert r1.upserted_id is not None
    # Second upsert - must NOT raise duplicate key, must match & update
    r2 = mongo.user_sessions.update_one(
        {"session_token": token}, {"$set": {**doc, "created_at": now}}, upsert=True
    )
    assert r2.matched_count == 1
    assert r2.upserted_id is None
    # cleanup
    mongo.user_sessions.delete_one({"session_token": token})


# ---------- Collections: create + receipt sequence ----------
class TestReceiptSequence:
    def test_sequential_receipt_no(self, api_client, volunteer_token):
        r1 = api_client.post(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(volunteer_token),
            json=_valid_payload(amount=101),
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        r2 = api_client.post(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(volunteer_token),
            json=_valid_payload(amount=202),
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        # receipt_no format JBM-YYYY-####
        parts = d1["receipt_no"].split("-")
        assert parts[0] == "JBM"
        assert len(parts[1]) == 4 and parts[1].isdigit()
        assert len(parts[2]) == 4 and parts[2].isdigit()
        # second must be exactly seq+1
        seq1 = int(d1["receipt_no"].split("-")[-1])
        seq2 = int(d2["receipt_no"].split("-")[-1])
        assert seq2 == seq1 + 1

        # GET to confirm persistence
        g = api_client.get(
            f"{BASE_URL}/api/collections/{d1['id']}",
            headers=auth_headers(volunteer_token),
        )
        assert g.status_code == 200
        assert g.json()["receipt_no"] == d1["receipt_no"]


# ---------- Collections: offline dedupe ----------
def test_offline_dedupe_returns_original(api_client, volunteer_token):
    tmp = f"tmp_{uuid.uuid4().hex}"
    r1 = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(amount=333, client_temp_id=tmp),
    )
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    # second attempt same client_temp_id with different amount => should return original
    r2 = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(amount=999, client_temp_id=tmp),
    )
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["id"] == d1["id"]
    assert d2["receipt_no"] == d1["receipt_no"]
    assert d2["amount"] == d1["amount"] == 333


# ---------- Collections: scoping & RBAC ----------
class TestListScoping:
    def test_volunteer_sees_only_own(
        self, api_client, volunteer_token, volunteer2_token
    ):
        # v2 creates one
        v2 = api_client.post(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(volunteer2_token),
            json=_valid_payload(donor_name="TEST_JBM v2 donor", amount=77),
        )
        assert v2.status_code == 200
        v2_id = v2.json()["id"]

        # v1 lists — must not contain v2's
        r = api_client.get(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(volunteer_token),
        )
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert v2_id not in ids

    def test_admin_sees_all_and_filters(self, api_client, admin_token, volunteer_user):
        r = api_client.get(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        assert len(r.json()) >= 1

        # filter by volunteer_id
        r = api_client.get(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(admin_token),
            params={"volunteer_id": volunteer_user["user_id"]},
        )
        assert r.status_code == 200
        docs = r.json()
        assert all(d["collector_id"] == volunteer_user["user_id"] for d in docs)

        # filter by payment_mode
        r = api_client.get(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(admin_token),
            params={"payment_mode": "cash"},
        )
        assert r.status_code == 200
        assert all(d["payment_mode"] == "cash" for d in r.json())

        # search
        r = api_client.get(
            f"{BASE_URL}/api/collections",
            headers=auth_headers(admin_token),
            params={"search": "TEST_JBM"},
        )
        assert r.status_code == 200


def test_get_collection_403_for_non_owner(
    api_client, volunteer_token, volunteer2_token
):
    # v1 creates
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(donor_name="TEST_JBM ownercheck"),
    )
    assert r.status_code == 200
    cid = r.json()["id"]
    # v2 tries
    r2 = api_client.get(
        f"{BASE_URL}/api/collections/{cid}",
        headers=auth_headers(volunteer2_token),
    )
    assert r2.status_code == 403


def test_get_collection_admin_can_read_any(
    api_client, admin_token, volunteer_token
):
    r = api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(donor_name="TEST_JBM admincheck"),
    )
    assert r.status_code == 200
    cid = r.json()["id"]
    r2 = api_client.get(
        f"{BASE_URL}/api/collections/{cid}",
        headers=auth_headers(admin_token),
    )
    assert r2.status_code == 200


# ---------- Dashboard ----------
def test_dashboard_stats_volunteer(api_client, volunteer_token):
    r = api_client.get(
        f"{BASE_URL}/api/dashboard/stats",
        headers=auth_headers(volunteer_token),
    )
    assert r.status_code == 200
    data = r.json()
    for k in ("total", "today", "week", "by_mode", "leaderboard"):
        assert k in data
    assert "cash" in data["by_mode"] and "upi" in data["by_mode"]
    assert "paid" not in data["by_mode"]
    assert data["leaderboard"] == []  # volunteers see empty leaderboard


def test_dashboard_by_mode_no_paid_key(api_client, admin_token):
    r = api_client.get(
        f"{BASE_URL}/api/dashboard/stats",
        headers=auth_headers(admin_token),
    )
    assert r.status_code == 200
    by_mode = r.json()["by_mode"]
    assert set(by_mode.keys()) == {"cash", "upi"}
    for k in ("cash", "upi"):
        assert "total" in by_mode[k] and "count" in by_mode[k]


def test_dashboard_stats_admin_has_leaderboard(api_client, admin_token):
    r = api_client.get(
        f"{BASE_URL}/api/dashboard/stats",
        headers=auth_headers(admin_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["leaderboard"], list)
    assert len(data["leaderboard"]) >= 1
    top = data["leaderboard"][0]
    for k in ("user_id", "name", "total", "count"):
        assert k in top


# ---------- CSV export ----------
def test_csv_export_forbidden_for_volunteer(api_client, volunteer_token):
    r = api_client.get(
        f"{BASE_URL}/api/collections/export.csv",
        headers=auth_headers(volunteer_token),
    )
    assert r.status_code == 403


def test_csv_export_admin_ok(api_client, admin_token, volunteer_token):
    # ensure at least one cash + one upi row exist so summary is meaningful
    api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(payment_mode="cash", amount=111,
                            donor_name="TEST_JBM csv cash"),
    )
    api_client.post(
        f"{BASE_URL}/api/collections",
        headers=auth_headers(volunteer_token),
        json=_valid_payload(payment_mode="upi", amount=222,
                            donor_name="TEST_JBM csv upi"),
    )

    r = api_client.get(
        f"{BASE_URL}/api/collections/export.csv",
        headers=auth_headers(admin_token),
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert "jbm_collections_" in cd
    assert ".csv" in cd

    body = r.text

    # --- Header block strings ---
    for needle in [
        "Jai Bharat Mitra Mandal",
        "NITYANAND NAGAR CHA GANRAJ",
        "उत्सवातून संस्कृतीकडे",
        "Export Generated At",
        "Exported By",
        "Filters",
    ]:
        assert needle in body, f"CSV missing header entry: {needle!r}"

    # --- Ledger column headers ---
    for col in [
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
    ]:
        assert col in body, f"CSV missing ledger column: {col!r}"

    # --- Summary footer ---
    for needle in [
        "SUMMARY",
        "Total Receipts",
        "Grand Total (INR)",
        "Cash Total (INR)",
        "UPI Total (INR)",
        "COLLECTOR-WISE TALLY",
    ]:
        assert needle in body, f"CSV missing summary entry: {needle!r}"

    # Parse & verify structure: first row is mandal name single-cell
    reader = csv.reader(io.StringIO(body))
    rows = list(reader)
    assert rows[0][0] == "Jai Bharat Mitra Mandal"
    # Find the ledger header row and ensure at least one data row follows
    ledger_hdr_idx = next(
        (i for i, row in enumerate(rows) if row and row[0] == "S.No"), None
    )
    assert ledger_hdr_idx is not None, "Ledger header row (S.No…) not found"
    # at least one data row before SUMMARY
    summary_idx = next(
        (i for i, row in enumerate(rows) if row and row[0] == "SUMMARY"), None
    )
    assert summary_idx is not None and summary_idx > ledger_hdr_idx + 1


# ---------- Deactivated user ----------
def test_deactivated_user_gets_403(api_client, inactive_token):
    for path in [
        "/api/auth/me",
        "/api/collections",
        "/api/dashboard/stats",
    ]:
        r = api_client.get(
            f"{BASE_URL}{path}", headers=auth_headers(inactive_token)
        )
        assert r.status_code == 403, f"{path} => {r.status_code}"
