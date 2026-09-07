import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("regions", Path(__file__).with_name("extract-benchmark-heading-regions.py"))
regions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(regions)


class Tests(unittest.TestCase):
    def test_regions(self):
        rows = regions.extract('<nav><h2>Menu</h2></nav><main><article><header><h1>Title</h1></header><h2>A &amp; <em>B</em></h2><aside><h3>Related</h3></aside><h2>Next</h2></article></main><h2>Unknown</h2>')["headings"]
        self.assertEqual([r["region_state"] for r in rows], ["excluded_structural_region", "content_region_candidate", "content_region_candidate", "excluded_structural_region", "content_region_candidate", "unresolved_region"])
        self.assertEqual(rows[2]["text"], "A & B")
        self.assertEqual(rows[0]["text"], "Menu")
        self.assertTrue(all(not r["semantic_relevance_verified"] for r in rows))

    def test_hidden_and_roles(self):
        rows = regions.extract('<div role="main"><div hidden><h2>Hidden</h2></div><div role="navigation"><h2>Menu</h2></div><h2>Visible</h2></div>')["headings"]
        self.assertEqual(rows[-1]["region_state"], "content_region_candidate")
        self.assertTrue(all(r["region_state"] == "excluded_structural_region" for r in rows[:2]))

    def test_long_text_not_silently_removed(self):
        row = regions.extract('<main><h2>' + 'a' * 301 + '</h2></main>')["headings"][0]
        self.assertEqual(len(row["text"]), 301)
        self.assertEqual(row["flags"], ["long_text_requires_review"])


if __name__ == "__main__":
    unittest.main()
