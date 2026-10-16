#!/usr/bin/env python3
"""Check a production build without installing a test framework."""

import json
import hashlib
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree
from check_links import verify as verify_links


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []
        self.citations = []
        self.descriptions = []
        self.json_ld = []
        self.script = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for candidate in attrs.get("srcset", "").split(","):
            url = candidate.strip().split()
            if url and url[0].startswith("/assets/built/"):
                self.assets.append(urlsplit(url[0]).path)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.script = ""
        for key in ["src", "href", "data-search", "data-gallery", "data-pagefind"]:
            url = attrs.get(key)
            if not url:
                continue
            path = unquote(urlsplit(url).path)
            if not urlsplit(url).netloc:
                if path.startswith(("/assets/css/", "/assets/js/", "/assets/built/")):
                    self.assets.append(path)
                if path.startswith("/assets/citations/") or path.endswith(("/citation.ris", "/citation.csl.json", ".citation.ris", ".citation.csl.json")):
                    self.citations.append(path)
        if tag == "meta" and attrs.get("name") == "description":
            self.descriptions.append(attrs.get("content", ""))


    def handle_data(self, data):
        if self.script is not None:
            self.script += data

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.json_ld.append(json.loads(self.script))
            self.script = None


def verify(root):
    required = [
        "index.html", "search/index.html", "contact/index.html",
        "categories/index.html", "tags/index.html", "feed.xml", "sitemap.xml",
        "sitemapindex.xml", "pdf-archival-list.xml", "citations-archival-list.xml",
        "assets/css/main.css", "assets/js/main.js", "assets/js/search.js",
        "admin/index.html", "admin/config.yml",
        "_redirects", "_headers", "metadata.json", "oai/records.json", "indexnow.json", "standard.site/publication.json",
        "standard.site/documents.json", "standard.site/manifest.json",
        "sw.js", "offline.html", "assets/images/favicons/site.webmanifest",
    ]
    for name in required:
        assert (root / name).is_file(), f"Missing output: {name}"
    expected = json.loads((Path(__file__).parent.parent / "tests/fixtures/jekyll-public-pages.json").read_text())
    for name in expected:
        assert (root / name).is_file(), f"Lost public page: {name}"
    assert not list(root.rglob("*.scss")), "Sass sources published"
    assert not (root / "assets/js/vendor").exists(), "Legacy JavaScript vendor bundle published"
    assert not (root / "assets/js/lunr").exists(), "Legacy Lunr search published"
    bundles = list((root / "assets/built").glob("pagefind.*"))
    assert len(bundles) == 1, "Expected one Pagefind bundle"
    for name in ["pagefind.js", "pagefind-entry.json"]:
        assert (bundles[0] / name).is_file(), f"Missing Pagefind output: {name}"
    assert list(bundles[0].glob("index/*.pf_index")), "Missing Pagefind index chunks"
    entry = json.loads((bundles[0] / "pagefind-entry.json").read_text())
    assert sum(language["page_count"] for language in entry["languages"].values()) > 0, "Empty Pagefind index"
    assert not list(bundles[0].glob("pagefind-*.js")), "Unused Pagefind UI/worker bundle published"

    pages = list(root.rglob("*.html"))
    descriptions = 0
    citation_links = 0
    for path in pages:
        page = Page()
        html = path.read_text()
        assert not html.lstrip().startswith("---"), f"Unprocessed front matter: {path}"
        assert "{%" not in html and "{{ site." not in html, f"Unrendered Liquid: {path}"
        page.feed(html)
        if 'class="greedy-nav"' in html:
            assert len(page.json_ld) == 1, f"Expected one coherent JSON-LD graph: {path}"
            graph = page.json_ld[0]["@graph"]
            assert sum(node.get("@type") == "Organization" and node.get("@id", "").endswith("/#organization") for node in graph) == 1, path
        assert not any("jquery" in asset.lower() for asset in page.assets), path
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

    catalog = json.loads((root / "oai/records.json").read_text())
    assert catalog["records"], "No OAI records"
    assert len({r["identifier"] for r in catalog["records"]}) == len(catalog["records"])
    for record in catalog["records"]:
        ElementTree.fromstring(record["xml"])
    manifest = json.loads((root / "indexnow.json").read_text())
    assert "key" not in manifest and "keyLocation" not in manifest
    keys = [p for p in root.glob("*.txt") if p.read_text().strip() == p.stem and hashlib.sha256(p.stem.encode()).hexdigest() == manifest["keyVersion"]]
    assert len(keys) == 1, "Missing IndexNow ownership verification file"
    for record in manifest["records"]:
        assert urlsplit(record["url"]).netloc == manifest["host"]
    for path in root.rglob("citation.csl.json"):
        assert path.with_name("citation.ris").is_file(), path
        ElementTree.parse(path.with_name("dc.xml"))
        assert json.loads(path.read_text()), path

    standard = root / "standard.site"
    documents = json.loads((standard / "documents.json").read_text())
    manifest = json.loads((standard / "manifest.json").read_text())
    assert manifest["documentCount"] == len(documents) > 0
    for name in required:
        if name.endswith(".xml"):
            ElementTree.parse(root / name)
    protected = verify_links(root)
    print(f"PASS: {len(pages)} pages, {len(metadata)} metadata records, "
          f"{len(citations)} citation pairs, {len(documents)} standard.site documents; "
          f"links and fragments valid ({protected} protected URLs)")


if __name__ == "__main__":
    verify(Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve())
