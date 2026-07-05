#!/usr/bin/env python3
"""Check internal static-site links, with optional external URL checks."""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = [ROOT / "index.html", ROOT / "blog" / "index.html", ROOT / "evidence" / "index.html"]
SKIP_SCHEMES = {"mailto", "tel", "javascript"}
SELF_HOSTS = {"archegon.com", "www.archegon.com"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str, int]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if "id" in attrs_dict and attrs_dict["id"]:
            self.ids.add(attrs_dict["id"])
        for attr in ("href", "src"):
            value = attrs_dict.get(attr)
            if value:
                self.links.append((attr, value, self.getpos()[0]))


def parse_html(path: Path) -> LinkParser:
    parser = LinkParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def html_target_for(path: Path) -> Path:
    if path.is_dir():
        return path / "index.html"
    return path


def resolve_local(base_file: Path, link: str) -> tuple[Path, str]:
    parsed = urllib.parse.urlparse(link)
    path_part = urllib.parse.unquote(parsed.path)
    if path_part.startswith("/"):
        target = ROOT / path_part.lstrip("/")
    else:
        target = (base_file.parent / path_part).resolve()
    return html_target_for(target), parsed.fragment


def check_local_link(base_file: Path, link: str, ids_by_file: dict[Path, set[str]]) -> str | None:
    target, fragment = resolve_local(base_file, link)
    if not str(target).startswith(str(ROOT)):
        return f"escapes site root: {link}"
    if not target.exists():
        return f"missing target: {link}"
    if fragment and target.suffix == ".html":
        ids = ids_by_file.get(target)
        if ids is None:
            ids = parse_html(target).ids
            ids_by_file[target] = ids
        if fragment not in ids:
            return f"missing fragment #{fragment}: {link}"
    return None


def check_external_url(url: str, timeout: float) -> str | None:
    headers = {
        "User-Agent": "Mozilla/5.0 ArchegonLinkChecker/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    for method in ("HEAD", "GET"):
        request = urllib.request.Request(url, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                if 200 <= response.status < 400:
                    return None
                status = response.status
        except urllib.error.HTTPError as exc:
            status = exc.code
            if 300 <= status < 400:
                return None
            if method == "HEAD" and status in {403, 405, 406, 429}:
                continue
        except (urllib.error.URLError, TimeoutError) as exc:
            if method == "HEAD":
                continue
            return f"{type(exc).__name__}: {exc}"
        if method == "GET":
            return f"HTTP {status}"
    return "unreachable"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--external", action="store_true", help="also check http(s) links")
    parser.add_argument("--timeout", type=float, default=12.0, help="external URL timeout in seconds")
    args = parser.parse_args()

    ids_by_file = {path: parse_html(path).ids for path in HTML_FILES}
    failures: list[str] = []
    external_links: set[str] = set()

    for html_file in HTML_FILES:
        parsed_html = parse_html(html_file)
        for attr, link, line in parsed_html.links:
            parsed = urllib.parse.urlparse(link)
            if parsed.scheme in SKIP_SCHEMES:
                continue
            if parsed.scheme in {"http", "https"}:
                if parsed.netloc in SELF_HOSTS:
                    local_link = parsed.path or "/"
                    if parsed.fragment:
                        local_link = f"{local_link}#{parsed.fragment}"
                    problem = check_local_link(ROOT / "index.html", local_link, ids_by_file)
                    if problem:
                        failures.append(f"{html_file.relative_to(ROOT)}:{line} {attr} {problem}")
                    continue
                external_links.add(link)
                continue
            problem = check_local_link(html_file, link, ids_by_file)
            if problem:
                failures.append(f"{html_file.relative_to(ROOT)}:{line} {attr} {problem}")

    if args.external:
        for url in sorted(external_links):
            problem = check_external_url(url, args.timeout)
            if problem:
                failures.append(f"external {url} {problem}")

    if failures:
        print("Link check failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    external_note = " and external URLs" if args.external else ""
    print(f"Checked internal links{external_note}: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
