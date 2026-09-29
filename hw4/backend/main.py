"""Campus Customs catalogue and account API."""

import json
import logging
import re
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from auth import SESSION_SECONDS, create_session, hash_password, needs_rehash, token_hash, verify_password
from agent import AgentConfigurationError, reply_to_shopper
from models import ChatHistoryMessage, ChatHistoryResponse, ChatProduct, ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "campus_customs.db"

@contextmanager
def connect(readonly: bool = False):
    path = f"file:{DB_PATH.as_posix()}?mode=ro" if readonly else str(DB_PATH)
    db = sqlite3.connect(path, uri=readonly)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        if not readonly:
            db.commit()
    except Exception:
        if not readonly:
            db.rollback()
        raise
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with connect() as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            )"""
        )
    yield


app = FastAPI(title="Campus Customs Shop API", lifespan=lifespan)
app.mount("/media", StaticFiles(directory=DATA_DIR), name="media")


def chat_product_cards(product_ids: list[str]) -> list[ChatProduct]:
    """Resolve model-suggested IDs to trusted catalogue fields in display order."""
    selected = list(dict.fromkeys(product_ids))[:6]
    if not selected:
        return []
    placeholders = ", ".join("?" for _ in selected)
    with connect(readonly=True) as db:
        rows = db.execute(
            f"SELECT product_id, name, price, image_file_path, description "
            f"FROM catalogue WHERE product_id IN ({placeholders})",
            selected,
        ).fetchall()
    by_id = {row["product_id"]: row for row in rows}
    cards = []
    for product_id in selected:
        row = by_id.get(product_id)
        if row is None:
            continue
        description = row["description"]
        if len(description) > 160:
            description = description[:157].rstrip() + "..."
        cards.append(ChatProduct(
            product_id=product_id,
            name=row["name"],
            price=row["price"],
            image_url=f"/media/{row['image_file_path']}",
            description=description,
            product_url=f"/products/{product_id}",
        ))
    return cards


def authenticated_user(request: Request) -> sqlite3.Row | None:
    token = request.cookies.get("campus_session")
    if not token:
        return None
    with connect(readonly=True) as db:
        return db.execute(
            """SELECT users.* FROM auth_sessions
               JOIN users ON users.id = auth_sessions.user_id
               WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?""",
            (token_hash(token), int(time.time())),
        ).fetchone()


def verified_page_context(payload: ChatRequest) -> dict:
    path = payload.page_path
    if path.startswith("/products/"):
        path_id = unquote(path.removeprefix("/products/"))
        if path_id and payload.product_id == path_id:
            with connect(readonly=True) as db:
                product = db.execute(
                    "SELECT product_id, name FROM catalogue WHERE product_id = ?", (path_id,)
                ).fetchone()
            if product:
                return {"page": "product_detail", "product_id": product["product_id"], "product_name": product["name"]}
    if path == "/products":
        return {"page": "product_listing"}
    if path == "/about":
        return {"page": "about"}
    if path == "/":
        return {"page": "home"}
    if path in ("/login", "/create-account"):
        return {"page": "account"}
    return {"page": "other"}


def recent_chat_rows(user_id: int, limit: int) -> list[sqlite3.Row]:
    with connect(readonly=True) as db:
        rows = db.execute(
            """SELECT role, content, products_json FROM chat_messages
               WHERE user_id = ? AND role IN ('user', 'assistant')
               ORDER BY id DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


def saved_product_ids(products_json: str | None) -> list[str]:
    if not products_json:
        return []
    try:
        saved_products = json.loads(products_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(saved_products, list):
        return []
    return [
        item["product_id"] for item in saved_products
        if isinstance(item, dict) and isinstance(item.get("product_id"), str)
    ][:6]


@app.get("/api/chat/history", response_model=ChatHistoryResponse)
def chat_history(request: Request) -> ChatHistoryResponse:
    user = authenticated_user(request)
    if user is None:
        return ChatHistoryResponse(messages=[])
    messages = []
    for row in recent_chat_rows(user["id"], 100):
        product_ids = saved_product_ids(row["products_json"]) if row["role"] == "assistant" else []
        messages.append(ChatHistoryMessage(
            role=row["role"], text=row["content"], products=chat_product_cards(product_ids)
        ))
    return ChatHistoryResponse(messages=messages)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Enter a message to send")
    try:
        user = authenticated_user(request)
        context = verified_page_context(payload)
        history = []
        if user:
            context["shopper"] = {"name": user["name"], "email": user["email"]}
            for row in recent_chat_rows(user["id"], 12):
                content = row["content"]
                if row["role"] == "assistant":
                    ids = saved_product_ids(row["products_json"])
                    if ids:
                        content += "\n[Product cards shown, in order: " + ", ".join(ids) + "]"
                history.append((row["role"], content))
        answer = await reply_to_shopper(message, context=context, history=history)
        response = ChatResponse(
            message=answer.message,
            products=chat_product_cards(answer.product_ids),
        )
        if user:
            with connect() as db:
                db.execute(
                    "INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)",
                    (user["id"], message),
                )
                db.execute(
                    "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
                    (user["id"], response.message, json.dumps([card.model_dump() for card in response.products])),
                )
        return response
    except AgentConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("The shopping assistant could not complete a reply")
        raise HTTPException(status_code=502, detail="The shopping assistant is temporarily unavailable") from error


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def clean_email(email: str) -> str:
    value = email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    return value


def public_user(user: sqlite3.Row) -> dict:
    return {
        "id": user["id"], "first_name": user["first_name"] or user["name"],
        "last_name": user["last_name"] or "", "name": user["name"],
        "email": user["email"],
    }


def set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        "campus_session", token, max_age=SESSION_SECONDS, httponly=True,
        secure=request.url.scheme == "https", samesite="lax", path="/",
    )


@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response) -> dict:
    first_name = payload.first_name.strip()
    last_name = payload.last_name.strip()
    if not first_name or not last_name:
        raise HTTPException(status_code=422, detail="First and last name are required")
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    email = clean_email(payload.email)
    with connect() as db:
        if db.execute("SELECT 1 FROM users WHERE lower(email) = ?", (email,)).fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        try:
            cursor = db.execute(
                "INSERT INTO users (name, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)",
                (f"{first_name} {last_name}", first_name, last_name, email, hash_password(payload.password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="An account with this email already exists") from None
        user = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
        token = create_session(db, user["id"])
    set_session_cookie(response, request, token)
    return {"user": public_user(user)}


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, response: Response) -> dict:
    email = clean_email(payload.email)
    with connect() as db:
        user = db.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
        if user is None or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if needs_rehash(user["password_hash"]):
            db.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(payload.password), user["id"]),
            )
        token = create_session(db, user["id"])
    set_session_cookie(response, request, token)
    return {"user": public_user(user)}


@app.get("/api/auth/me")
def current_user(request: Request) -> dict:
    user = authenticated_user(request)
    return {"user": public_user(user) if user else None}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get("campus_session")
    if token:
        with connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (token_hash(token),))
    response.delete_cookie("campus_session", path="/", samesite="lax")
    return {"ok": True}


def serialize_product(row: sqlite3.Row, stock: list[dict]) -> dict:
    product = dict(row)
    product["colors"] = json.loads(product["colors"])
    product["search_tags"] = json.loads(product["search_tags"])
    product["image_url"] = f"/media/{product['image_file_path']}"
    product["inventory"] = stock
    return product


@app.get("/api/products")
def list_products() -> list[dict]:
    with connect(readonly=True) as db:
        products = db.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        inventory = db.execute(
            "SELECT product_id, size, quantity FROM inventory ORDER BY product_id, size"
        ).fetchall()
    stock_by_product: dict[str, list[dict]] = {}
    for row in inventory:
        stock_by_product.setdefault(row["product_id"], []).append(
            {"size": row["size"], "quantity": row["quantity"]}
        )
    return [
        serialize_product(product, stock_by_product.get(product["product_id"], []))
        for product in products
    ]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with connect(readonly=True) as db:
        product = db.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        stock = db.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY size",
            (product_id,),
        ).fetchall()
    return serialize_product(product, [dict(row) for row in stock])
