#!/usr/bin/env python3
"""Build the gallery data bundle for the preview or the production docs site.

Source of truth:
  - config/gallery.json  site/theme/taxonomy/cards/badgeRegistry
  - config/repos.yml     docs build matrix (only name + git url)
  - content/cases/**     one Markdown file per application case

The production mode rewrites preview-relative paths into paths relative to
docs/index.html and writes both data.js and a fallback gallery.json.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parents[1]

SECTION_KEYS = {
    "场景": "context",
    "问题": "problem",
    "方案": "approach",
    "结果": "result",
    "边界": "boundary",
}
REQUIRED_META = ["slug", "title", "outcome", "summary"]
REQUIRED_SECTIONS = ["context", "problem", "approach", "result", "boundary"]
ASSET_PREFIX = "_static/gallery/assets"
SITE_LOGO = "_static/pngs/logo.png"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_case(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---\n"):
        fail(f"{path}: missing YAML frontmatter")
    end = raw.find("\n---", 4)
    if end == -1:
        fail(f"{path}: unterminated YAML frontmatter")
    meta = yaml.safe_load(raw[4:end]) or {}
    body = raw[end + 4 :]

    missing = [key for key in REQUIRED_META if not meta.get(key)]
    if missing:
        fail(f"{path}: missing frontmatter fields: {', '.join(missing)}")

    sections: dict[str, Any] = {}
    current = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer
        if current == "approach":
            sections[current] = [
                line.strip()[2:].strip()
                for line in buffer
                if line.strip().startswith("- ")
            ]
        elif current:
            sections[current] = " ".join(
                line.strip() for line in buffer if line.strip()
            )
        buffer = []

    for line in body.splitlines():
        if line.startswith("## "):
            flush()
            heading = line[3:].strip()
            current = SECTION_KEYS.get(heading)
            if not current:
                fail(f"{path}: unknown section heading: {heading}")
        elif current:
            buffer.append(line)
    flush()

    missing_sections = [key for key in REQUIRED_SECTIONS if not sections.get(key)]
    if missing_sections:
        fail(f"{path}: missing case sections: {', '.join(missing_sections)}")

    source = meta.get("source") or {}
    if not source.get("url"):
        fail(f"{path}: source.url is required")

    projects = meta.get("projects") or meta.get("project") or []
    if isinstance(projects, str):
        projects = [projects]
    if not projects:
        fail(f"{path}: projects must contain at least one project or recipe")

    return {
        "slug": meta["slug"],
        "projects": projects,
        "title": meta["title"],
        "outcome": meta["outcome"],
        "summary": meta["summary"],
        "audience": meta.get("audience") or [],
        "tags": meta.get("tags") or [],
        "cover": meta.get("cover") or "",
        "coverAlt": meta.get("coverAlt") or meta["title"],
        "figureCaption": meta.get("figureCaption") or "",
        "sourceLabel": source.get("label") or "完整技术细节",
        "sourceUrl": source["url"],
        "sections": sections,
        "featured": bool(meta.get("featured", False)),
        "order": meta.get("order", 999),
        "reviewedAt": meta.get("reviewed_at") or "",
        "visible": bool(meta.get("visible", True)),
    }


def validate_badge_urls(cards: list[dict[str, Any]]) -> None:
    for card in cards:
        badges = card.get("badges")
        if badges is None:
            continue
        if not isinstance(badges, list):
            fail(f"{card.get('name', '<unnamed>')}: badges must be an array")
        for badge in badges:
            if not isinstance(badge, dict):
                continue
            for key in ("url", "href"):
                url = badge.get(key)
                if not url:
                    continue
                parsed = urlparse(str(url))
                if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                    fail(
                        f"{card.get('name', '<unnamed>')}: badge {key} must be an "
                        f"absolute http(s) URL: {url}"
                    )


def validate_descriptions(cards: list[dict[str, Any]]) -> None:
    for card in cards:
        summary = card.get("summary") or ""
        description = card.get("description") or ""
        if summary and description and summary not in description:
            fail(
                f"{card.get('name', '<unnamed>')}: description must contain the full "
                "summary (featured cards render description instead of summary)"
            )


def load_repo_names(path: Path) -> set[str]:
    if not path.exists():
        fail(f"missing build matrix: {path}")
    config = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    repos = config.get("repos") or []
    if not isinstance(repos, list):
        fail(f"{path}: repos must be a list")
    names = {repo.get("name") for repo in repos if isinstance(repo, dict)}
    if not names:
        fail(f"{path}: no repo names found")
    return {name for name in names if name}


def rewrite_asset(value: str, mode: str) -> str:
    if not value or not value.startswith("assets/"):
        return value
    if mode == "preview":
        return value
    return f"{ASSET_PREFIX}/{value[len('assets/'):]}"


def rewrite_docs(value: str, mode: str) -> str:
    if not value or not value.startswith("docs/"):
        return value
    if mode == "preview":
        return value
    return value[len("docs/"):]


def transform(data: dict[str, Any], mode: str) -> None:
    site = data.get("site") or {}
    if mode == "preview":
        if site.get("logo") == SITE_LOGO:
            site["logo"] = "assets/site/logo.png"
        return

    if site.get("logo", "").startswith("assets/"):
        site["logo"] = SITE_LOGO

    for card in data.get("cards", []):
        card["url"] = rewrite_docs(card.get("url", ""), mode)
        card["cover"] = rewrite_asset(card.get("cover", ""), mode)
        card["logo"] = rewrite_asset(card.get("logo", ""), mode)
        for guide in card.get("guides") or []:
            guide["href"] = rewrite_docs(guide.get("href", ""), mode)

    for case in data.get("cases", []):
        case["cover"] = rewrite_asset(case.get("cover", ""), mode)
        case["sourceUrl"] = rewrite_docs(case.get("sourceUrl", ""), mode)


def build(args: argparse.Namespace) -> None:
    if args.mode == "preview":
        config_path = ROOT / "workspace/preview/_config/gallery.json"
        cases_dir = ROOT / "workspace/preview/content/cases"
        out_path = ROOT / "workspace/preview/js/data.js"
        json_out = None
    else:
        config_path = ROOT / "config/gallery.json"
        cases_dir = ROOT / "content/cases"
        out_path = ROOT / "docs/_static/gallery/js/data.js"
        json_out = ROOT / "docs/_config/gallery.json"

    if args.out:
        out_path = Path(args.out)
    if args.json_out:
        json_out = Path(args.json_out)
    elif args.mode == "preview":
        json_out = None

    if not config_path.exists():
        fail(f"missing gallery config: {config_path}")
    if not cases_dir.exists():
        fail(f"missing cases directory: {cases_dir}")

    data = json.loads(config_path.read_text(encoding="utf-8"))
    cards = data.get("cards") or []
    if not isinstance(cards, list) or not cards:
        fail("gallery config must contain a non-empty cards array")

    card_names = [card.get("name") for card in cards]
    if any(not name for name in card_names):
        fail("every card must have a name")
    if len(card_names) != len(set(card_names)):
        fail("duplicate card name in gallery config")

    repo_names = load_repo_names(ROOT / "config/repos.yml")
    first_party = {
        card["name"]
        for card in cards
        if card.get("origin", "first-party") == "first-party"
    }
    missing_cards = sorted(repo_names - first_party)
    if missing_cards:
        fail(f"repos missing a gallery card: {', '.join(missing_cards)}")
    missing_repos = sorted(first_party - repo_names)
    if missing_repos:
        fail(f"first-party cards missing from repos.yml: {', '.join(missing_repos)}")

    validate_badge_urls(cards)
    validate_descriptions(cards)

    cases = [parse_case(path) for path in sorted(cases_dir.glob("*/*.md"))]
    if not cases:
        fail(f"no case files found under {cases_dir}")
    slugs = [case["slug"] for case in cases]
    if len(slugs) != len(set(slugs)):
        fail("duplicate case slug")
    known = set(card_names)
    for case in cases:
        missing = [name for name in case["projects"] if name not in known]
        if missing:
            fail(f"{case['slug']}: unknown related project/recipe: {', '.join(missing)}")

    data["cases"] = cases
    if args.asset_version:
        data.setdefault("site", {})["assetVersion"] = args.asset_version

    transform(data, args.mode)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        "window.__GALLERY_DATA__ = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )

    if json_out:
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    try:
        display_path = out_path.relative_to(ROOT)
    except ValueError:
        display_path = out_path
    print(
        f"wrote {display_path} "
        f"({out_path.stat().st_size} bytes, {len(cards)} cards, {len(cases)} cases)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("preview", "production"),
        default="production",
        help="preview keeps docs/ and assets/ paths; production rewrites them",
    )
    parser.add_argument(
        "--asset-version",
        default=os.environ.get("GITHUB_SHA", ""),
        help="cache-busting value written into site.assetVersion",
    )
    parser.add_argument("--out", default=None, help="override data.js output path")
    parser.add_argument(
        "--json-out", default=None, help="override gallery.json output path"
    )
    args = parser.parse_args()
    if args.mode == "preview":
        args.asset_version = ""
    build(args)


if __name__ == "__main__":
    main()
