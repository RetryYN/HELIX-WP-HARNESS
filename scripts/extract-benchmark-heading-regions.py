"""Offline structural evidence; never treat tag placement as semantic relevance."""
import json
import re
import sys
from html.parser import HTMLParser


class HeadingRegions(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.headings = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        roles = set(attrs.get("role", "").lower().split())
        parent = self.stack[-1] if self.stack else {}
        entry = {
            "tag": tag,
            "excluded": parent.get("excluded", False) or tag in {"nav", "aside", "footer", "script", "style", "template", "noscript"} or bool(roles & {"navigation", "complementary", "contentinfo", "banner"}) or "hidden" in attrs or attrs.get("aria-hidden", "").lower() == "true",
            "content": parent.get("content", False) or tag in {"main", "article"} or "main" in roles,
        }
        # A header inside an article can contain the article title; do not discard it globally.
        if re.fullmatch(r"h[1-6]", tag):
            self.finish_heading()
            self.current = {"level": int(tag[1]), "position": len(self.headings), "parts": [], "excluded": entry["excluded"], "content": entry["content"]}
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(entry)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        if self.current and not any(e["tag"] in {"script", "style", "template", "noscript"} for e in self.stack):
            self.current["parts"].append(data)

    def finish_heading(self):
        if self.current is None:
            return
        row = self.current
        text = re.sub(r"\s+", " ", "".join(row.pop("parts"))).strip()
        excluded, content = row.pop("excluded"), row.pop("content")
        row.update(text=text, region_state="excluded_structural_region" if excluded else "content_region_candidate" if content else "unresolved_region", flags=["long_text_requires_review"] if len(text) > 300 else [], semantic_relevance_verified=False)
        self.headings.append(row)
        self.current = None

    def handle_endtag(self, tag):
        if self.current and tag == f'h{self.current["level"]}':
            self.finish_heading()
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                break


def extract(html):
    parser = HeadingRegions()
    parser.feed(html)
    parser.close()
    parser.finish_heading()
    return {"schema_version": "benchmark-heading-regions.v1", "headings": parser.headings, "policy": "structural_candidates_not_semantic_judgments"}


if __name__ == "__main__":
    print(json.dumps(extract(sys.stdin.read()), ensure_ascii=False))
