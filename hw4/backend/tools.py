"""Read-only shop facts available to the PydanticAI assistant."""

import json
import math
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs.db"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Open the supplied shop database without write access."""
    db = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    try:
        yield db
    finally:
        db.close()


def get_store_overview() -> dict:
    """Return the number of products and garment types in the shop catalogue."""
    with connect() as db:
        count = db.execute("SELECT COUNT(*) FROM catalogue").fetchone()[0]
        types = [
            row[0]
            for row in db.execute("SELECT DISTINCT garment_type FROM catalogue ORDER BY garment_type")
        ]
    return {"product_count": count, "garment_types": types}


def search_products(query: str, limit: int = 8) -> dict:
    """Find catalogue products by words in name, type, description, colors, or tags.

    Search results identify products. Call get_product_details for full facts or
    check_size_stock for an exact size quantity.
    """
    words = re.findall(r"[a-z0-9]+", query.lower())[:8]
    words = ["hoodie" if word == "hoodies" else word for word in words]
    if not words:
        return {"query": query, "products": [], "error": "Enter a product search term."}
    safe_limit = max(1, min(limit, 20))
    searchable = "lower(name || ' ' || garment_type || ' ' || description || ' ' || colors || ' ' || search_tags)"
    where = " AND ".join(f"instr({searchable}, ?) > 0" for _ in words)
    with connect() as db:
        rows = db.execute(
            f"SELECT product_id, name, garment_type, price FROM catalogue WHERE {where} ORDER BY name LIMIT ?",
            (*words, safe_limit),
        ).fetchall()
    return {"query": query, "products": [dict(row) for row in rows], "result_limit": safe_limit}


def find_products_by_budget_and_size(
    query: str = "",
    max_price: float | None = None,
    size: str | None = None,
    garment_type: str | None = None,
    strictly_under: bool = False,
    limit: int = 8,
) -> dict:
    """Find products matching a budget, garment type, and an in-stock size.

    Use this for requests such as "hoodies under $50 in size M". A size match
    means product-and-size quantity is positive, not that any listed color is
    available in that size. All prices and quantities come from SQLite.
    """
    if max_price is not None and (not math.isfinite(max_price) or max_price < 0):
        return {"products": [], "error": "Maximum price must be a nonnegative amount."}
    normalized_size = size.strip().upper() if size else None
    if normalized_size == "":
        normalized_size = None
    words = re.findall(r"[a-z0-9]+", query.lower())[:8]
    words = ["hoodie" if word == "hoodies" else word for word in words]
    conditions = []
    params: list[str | float | int] = []
    searchable = "lower(c.name || ' ' || c.garment_type || ' ' || c.description || ' ' || c.colors || ' ' || c.search_tags)"
    for word in words:
        conditions.append(f"instr({searchable}, ?) > 0")
        params.append(word)
    if garment_type and garment_type.strip():
        conditions.append("instr(lower(c.garment_type), ?) > 0")
        params.append(garment_type.strip().lower())
    if max_price is not None:
        conditions.append("c.price < ?" if strictly_under else "c.price <= ?")
        params.append(max_price)
    if normalized_size:
        conditions.append("i.size = ? AND i.quantity > 0")
        params.append(normalized_size)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    join = "JOIN inventory i ON i.product_id = c.product_id" if normalized_size else ""
    quantity_column = ", i.quantity AS size_quantity" if normalized_size else ""
    safe_limit = max(1, min(limit, 20))
    with connect() as db:
        rows = db.execute(
            f"SELECT c.product_id, c.name, c.garment_type, c.price{quantity_column} "
            f"FROM catalogue c {join}{where} ORDER BY c.price, c.name LIMIT ?",
            (*params, safe_limit),
        ).fetchall()
    return {
        "query": query,
        "max_price": max_price,
        "strictly_under": strictly_under,
        "size": normalized_size,
        "garment_type": garment_type,
        "products": [dict(row) for row in rows],
        "result_limit": safe_limit,
        "color_specific_stock_known": False,
    }


def find_in_stock_alternatives(product_id: str, size: str, limit: int = 4) -> dict:
    """Suggest same-garment-type products when this product's size is sold out.

    Call only after checking the requested product and size. The returned
    alternatives have positive stock for that size, but color-and-size stock
    cannot be verified from this database.
    """
    normalized_size = size.strip().upper()
    if not normalized_size:
        return {"product_id": product_id, "alternatives": [], "error": "Enter a size."}
    with connect() as db:
        product = db.execute(
            "SELECT product_id, name, garment_type, price FROM catalogue WHERE product_id = ?",
            (product_id,),
        ).fetchone()
        if product is None:
            return {"product_id": product_id, "alternatives": [], "found": False}
        stock = db.execute(
            "SELECT quantity FROM inventory WHERE product_id = ? AND upper(size) = ?",
            (product_id, normalized_size),
        ).fetchone()
        if stock is None or stock["quantity"] > 0:
            return {
                "product_id": product_id,
                "size": normalized_size,
                "size_listed": stock is not None,
                "quantity": stock["quantity"] if stock else None,
                "alternatives": [],
                "found": True,
            }
        safe_limit = max(1, min(limit, 12))
        rows = db.execute(
            """SELECT c.product_id, c.name, c.garment_type, c.price,
                      i.quantity AS size_quantity
               FROM catalogue c JOIN inventory i ON i.product_id = c.product_id
               WHERE c.product_id != ? AND c.garment_type = ?
                 AND upper(i.size) = ? AND i.quantity > 0
               ORDER BY abs(c.price - ?), c.name LIMIT ?""",
            (product_id, product["garment_type"], normalized_size, product["price"], safe_limit),
        ).fetchall()
    return {
        "product_id": product_id,
        "product_name": product["name"],
        "size": normalized_size,
        "quantity": 0,
        "size_listed": True,
        "alternatives": [dict(row) for row in rows],
        "found": True,
        "color_specific_stock_known": False,
    }


def get_product_details(product_id: str) -> dict:
    """Get one product's description, price, listed colors, and all size stock.

    Listed colors do not establish stock for any color-and-size combination.
    """
    with connect() as db:
        product = db.execute(
            "SELECT product_id, name, garment_type, description, colors, price FROM catalogue WHERE product_id = ?",
            (product_id,),
        ).fetchone()
        if product is None:
            return {"product_id": product_id, "found": False}
        stock = db.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY size",
            (product_id,),
        ).fetchall()
    details = dict(product)
    details["colors"] = json.loads(details["colors"])
    details["size_stock"] = [dict(row) for row in stock]
    details["color_specific_stock_known"] = False
    details["found"] = True
    return details


def check_size_stock(product_id: str, size: str) -> dict:
    """Check an exact product and size; no color-specific stock is recorded."""
    normalized_size = size.strip().upper()
    with connect() as db:
        product = db.execute(
            "SELECT name FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if product is None:
            return {"product_id": product_id, "size": normalized_size, "found": False}
        stock = db.execute(
            "SELECT quantity FROM inventory WHERE product_id = ? AND upper(size) = ?",
            (product_id, normalized_size),
        ).fetchone()
    return {
        "product_id": product_id,
        "product_name": product["name"],
        "size": normalized_size,
        "quantity": stock["quantity"] if stock else None,
        "size_listed": stock is not None,
        "color_specific_stock_known": False,
        "found": True,
    }
