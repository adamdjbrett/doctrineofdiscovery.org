#!/usr/bin/env python3
"""Check a production build without installing a test framework."""

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []
        self.citations = []
        self.descriptions = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        url = attrs.get("src") if tag == "script" else attrs.get("href")
        if url:
            path = unquote(urlsplit(url).path)
            if not urlsplit(url).netloc:
                if path.startswith(("/assets/css/", "/assets/js/")):
                    self.assets.append(path)
                if path.startswith("/assets/citations/"):
                    self.citations.append(path)
        if tag == "meta" and attrs.get("name") == "description":
            self.descriptions.append(attrs.get("content", ""))


def verify(root):
    required = [
        "index.html", "search/index.html", "contact/index.html",
        "categories/index.html", "tags/index.html", "feed.xml", "sitemap.xml",
        "sitemapindex.xml", "pdf-archival-list.xml", "citations-archival-list.xml",
        "assets/css/main.css", "assets/js/main.min.js",
        "assets/js/lunr/lunr.min.js", "assets/js/lunr/lunr-store.js",
        "assets/js/lunr/lunr-en.js", "admin/index.html", "admin/config.yml",
        "_redirects", "metadata.json", "standard.site/publication.json",
        "standard.site/documents.json", "standard.site/manifest.json",
    ]
    for name in required:
        assert (root / name).is_file(), f"Missing output: {name}"

    pages = list(root.rglob("*.html"))
    descriptions = 0
    citation_links = 0
    for path in pages:
        page = Page()
        page.feed(path.read_text())
        for asset in page.assets + page.citations:
            assert (root / asset.lstrip("/")).is_file(), f"{path}: missing {asset}"
        descriptions += sum(bool(value.strip()) for value in page.descriptions)
        citation_links += len(page.citations)
    assert descriptions > 0, "No SEO descriptions rendered"
    assert citation_links > 0, "No citation download links rendered"

    metadata = list(root.rglob("metadata.json"))
    for path in metadata:
        record = json.loads(path.read_text())
        assert record["@type"] in ("WebSite", "BlogPosting"), path
        assert record.get("url"), path
    assert len(metadata) > 1, "No per-post metadata generated"

    citations = list((root / "assets/citations").glob("*.csl.json"))
    assert citations, "No CSL-JSON citations generated"
    for path in citations:
        record = json.loads(path.read_text())
        assert record, f"Empty citation: {path}"
        assert path.with_name(path.name.removesuffix(".csl.json") + ".ris").is_file(), path

    standard = root / "standard.site"
    documents = json.loads((standard / "documents.json").read_text())
    manifest = json.loads((standard / "manifest.json").read_text())
    assert manifest["documentCount"] == len(documents) > 0
    for name in required:
        if name.endswith(".xml"):
            ElementTree.parse(root / name)
    print(f"PASS: {len(pages)} HTML pages, {len(metadata)} metadata records, "
          f"{len(citations)} citation pairs, {len(documents)} Standard.site documents")


if __name__ == "__main__":
    verify(Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve())
