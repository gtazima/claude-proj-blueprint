"""
Run SQL migration files against the production Supabase database.

Usage:
    python scripts/migrate.py                   # run all pending migrations
    python scripts/migrate.py 004_purchase.sql  # run a specific file

Requires SUPABASE_DATABASE_URL in .env (or environment).
"""

import os
import sys
from pathlib import Path

import urllib.parse

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DB_URL = os.environ.get("SUPABASE_DATABASE_URL")
if not DB_URL:
    sys.exit("SUPABASE_DATABASE_URL not set in .env")

MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


def _parse_url(url: str) -> dict:
    u = urllib.parse.urlparse(url)
    return {
        "host": u.hostname,
        "port": u.port or 5432,
        "dbname": u.path.lstrip("/"),
        "user": urllib.parse.unquote(u.username or ""),
        "password": urllib.parse.unquote(u.password or ""),
        "sslmode": "require",
    }


def run(sql: str, conn) -> None:
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def ensure_migrations_table(conn) -> None:
    run(
        """
        CREATE TABLE IF NOT EXISTS _migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        conn,
    )


def applied(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM _migrations")
        return {row[0] for row in cur.fetchall()}


def mark_applied(filename: str, conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO _migrations (filename) VALUES (%s) ON CONFLICT DO NOTHING",
            (filename,),
        )
    conn.commit()


def main() -> None:
    specific = sys.argv[1] if len(sys.argv) > 1 else None

    conn = psycopg2.connect(**_parse_url(DB_URL))
    ensure_migrations_table(conn)
    done = applied(conn)

    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if specific:
        files = [f for f in files if f.name == specific or specific in f.name]
        if not files:
            sys.exit(f"No migration file matching '{specific}'")

    ran = 0
    for f in files:
        if f.name in done and not specific:
            print(f"  skip  {f.name}")
            continue
        print(f"  apply {f.name} ... ", end="", flush=True)
        run(f.read_text(encoding="utf-8"), conn)
        mark_applied(f.name, conn)
        print("ok")
        ran += 1

    conn.close()
    print(f"\n{ran} migration(s) applied.")


if __name__ == "__main__":
    main()
