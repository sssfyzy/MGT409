"""Password hashing and opaque login sessions for the shop."""

import hashlib
import hmac
import secrets
import sqlite3
import time


HASH_ITERATIONS = 600_000
LEGACY_ITERATIONS = 120_000  # Used by the supplied seed accounts.
SESSION_SECONDS = 7 * 24 * 60 * 60


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("ascii"), HASH_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${HASH_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    if len(parts) == 3 and parts[0] == "pbkdf2_sha256":
        _, salt, expected = parts
        iterations = LEGACY_ITERATIONS
    elif len(parts) == 4 and parts[0] == "pbkdf2_sha256":
        _, count, salt, expected = parts
        try:
            iterations = int(count)
        except ValueError:
            return False
        if not 1 <= iterations <= 2_000_000:
            return False
    else:
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("ascii"), iterations
    ).hex()
    return hmac.compare_digest(actual, expected)


def needs_rehash(stored_hash: str) -> bool:
    parts = stored_hash.split("$")
    return len(parts) == 3 or (len(parts) == 4 and int(parts[1]) < HASH_ITERATIONS)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def create_session(db: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (int(time.time()),))
    db.execute(
        "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (token_hash(token), user_id, int(time.time()) + SESSION_SECONDS),
    )
    return token
