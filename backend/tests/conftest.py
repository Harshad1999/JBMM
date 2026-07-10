"""Shared fixtures for JBMM Collection App backend tests.

NOTE: auth now goes through Firebase (see backend/server.py — get_current_user
verifies a real Firebase ID token on every request). There is no more
server-side `user_sessions` collection to seed a fake token into, so the
token-seeding fixtures below are stale and will need to be reworked to
either (a) mint a real Firebase custom/ID token for a test user via the
Firebase Admin SDK, or (b) mock `firebase_auth.verify_id_token` in tests
that don't need a real backend round-trip. Left mostly intact as a
reference for the request/response shapes; the auth fixtures need updating
before these tests will pass again.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend .env for MONGO_URL / DB_NAME
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or "http://localhost:8080"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Marker prefixes for cleanup
TEST_PREFIX = "TEST_JBM_"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _seed_user(mongo, role: str, active: bool = True) -> dict:
    now = datetime.now(timezone.utc)
    uid = f"user_{TEST_PREFIX}{uuid.uuid4().hex[:8]}"
    email = f"{TEST_PREFIX}{uid}@example.com"
    user = {
        "user_id": uid,
        "email": email,
        "name": f"{TEST_PREFIX}{role}",
        "picture": None,
        "role": role,
        "active": active,
        "created_at": now,
    }
    mongo.users.insert_one(dict(user))
    return user


def _seed_session(mongo, user_id: str, expired: bool = False) -> str:
    now = datetime.now(timezone.utc)
    token = f"{TEST_PREFIX}tok_{uuid.uuid4().hex}"
    expires = now - timedelta(days=1) if expired else now + timedelta(days=7)
    mongo.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "expires_at": expires,
            "created_at": now,
        }
    )
    return token


@pytest.fixture(scope="session")
def admin_user(mongo):
    return _seed_user(mongo, role="admin")


@pytest.fixture(scope="session")
def admin_token(mongo, admin_user):
    return _seed_session(mongo, admin_user["user_id"])


@pytest.fixture(scope="session")
def volunteer_user(mongo):
    return _seed_user(mongo, role="volunteer")


@pytest.fixture(scope="session")
def volunteer_token(mongo, volunteer_user):
    return _seed_session(mongo, volunteer_user["user_id"])


@pytest.fixture(scope="session")
def volunteer2_user(mongo):
    return _seed_user(mongo, role="volunteer")


@pytest.fixture(scope="session")
def volunteer2_token(mongo, volunteer2_user):
    return _seed_session(mongo, volunteer2_user["user_id"])


@pytest.fixture(scope="session")
def inactive_user(mongo):
    return _seed_user(mongo, role="volunteer", active=False)


@pytest.fixture(scope="session")
def inactive_token(mongo, inactive_user):
    return _seed_session(mongo, inactive_user["user_id"])


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def _cleanup(mongo):
    """After the whole session, remove all TEST_JBM_* data."""
    yield
    mongo.users.delete_many({"user_id": {"$regex": f"^user_{TEST_PREFIX}"}})
    mongo.user_sessions.delete_many({"session_token": {"$regex": f"^{TEST_PREFIX}"}})
    mongo.collections.delete_many(
        {"collector_id": {"$regex": f"^user_{TEST_PREFIX}"}}
    )


@pytest.fixture(autouse=True, scope="session")
def _auto_cleanup(_cleanup):
    yield
