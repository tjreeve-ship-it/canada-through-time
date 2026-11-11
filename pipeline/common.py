from __future__ import annotations

import hashlib
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def load_registry() -> dict:
    return yaml.safe_load((ROOT / "registry/sources.yaml").read_text())


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_raw(rel: str, expected: str) -> Path:
    """Refuse to run if a raw source file is missing or differs from the registry hash."""
    p = ROOT / rel
    got = sha256(p)
    if got != expected:
        raise RuntimeError(f"{rel}: sha256 {got} does not match registry {expected}. "
                           "Raw data changed — re-register it as a new version instead of overwriting.")
    return p
