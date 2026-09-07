"""Keyless checks for the adapter's project-specific rules, not SDK availability."""
import copy
import runpy
import unittest
from pathlib import Path

bridge = runpy.run_path(str(Path(__file__).resolve().parents[1] / "python" / "bridge.py"))


class ProjectRulesTest(unittest.TestCase):
    def setUp(self):
        self.definition = {
            "classes": [
                {"id": "Author", "identityKeys": ["email"], "properties": [{"id": "email", "dataType": "string", "required": True, "unique": True}]},
                {"id": "Article", "identityKeys": ["name"], "properties": [{"id": "pages", "dataType": "number", "required": True}]},
            ],
            "relationships": [{"id": "writes", "domain": "Author", "range": "Article", "cardinality": "one-to-many"}],
            "confidenceThreshold": .6,
            "competencyQuestions": [{"id": "authors", "query": {"kind": "lookup", "sourceType": "Author", "minAnswers": 1}}],
        }
        self.graph = {
            "entities": [
                {"id": "a", "name": "Lin", "type": "Author", "properties": {"email": "lin@example.test"}, "confidence": .9, "sourceRefs": ["source-a"]},
                {"id": "p", "name": "Research", "type": "Article", "properties": {"pages": 12}, "confidence": .9, "sourceRefs": ["source-a"]},
            ],
            "relationships": [{"id": "e", "source": "a", "target": "p", "type": "writes", "confidence": .9, "sourceRefs": ["source-a"]}],
        }

    def issues(self):
        return {item["code"] for item in bridge["_project_issues"](self.graph, self.definition)}

    def context(self, **input):
        return bridge["_context"]({"graph": self.graph, "definition": self.definition, "seedNodeId": "a", "allowedSourceIds": ["source-a"], "asOf": "2026-09-07T00:00:00Z", **input})

    def test_valid_different_domain(self):
        self.assertEqual(self.issues(), set())
        self.assertEqual(len(self.context()["entities"]), 2)

    def test_required_identity_unique_and_datatype(self):
        del self.graph["entities"][0]["properties"]["email"]
        self.graph["entities"][1]["properties"]["pages"] = "twelve"
        self.assertTrue({"required", "identity-missing", "datatype"} <= self.issues())
        self.setUp()
        self.graph["entities"].append({**copy.deepcopy(self.graph["entities"][0]), "id": "another"})
        self.assertTrue({"unique", "identity-duplicate"} <= self.issues())

    def test_domain_range_and_cardinality(self):
        self.graph["relationships"][0]["target"] = "a"
        self.assertIn("domain-range", self.issues())
        self.setUp()
        self.graph["entities"].append({**copy.deepcopy(self.graph["entities"][0]), "id": "b", "properties": {"email": "other@example.test"}})
        self.graph["relationships"].append({**self.graph["relationships"][0], "id": "e2", "source": "b"})
        self.assertIn("cardinality", self.issues())

    def test_excluded_edges_cannot_connect_a_path(self):
        for key, value in [("validUntil", "2020-01-01"), ("validFrom", "2030-01-01"), ("validUntil", "bad"), ("sourceRefs", ["outside-project"]), ("confidence", .1)]:
            with self.subTest(key=key, value=value):
                self.setUp()
                self.graph["relationships"][0][key] = value
                self.assertEqual([node["id"] for node in self.context()["entities"]], ["a"])
                self.assertEqual(self.context()["relationships"], [])

    def test_expired_seed_and_unknown_selection_fail(self):
        self.graph["entities"][0]["validUntil"] = "2020-01-01"
        with self.assertRaises(ValueError):
            self.context()
        self.setUp()
        with self.assertRaises(ValueError):
            self.context(seedNodeId=None, query="natural language only")
        with self.assertRaises(ValueError):
            self.context(questionId="missing")

    def test_extraction_uses_identity_not_name_and_does_not_overwrite_conflicts(self):
        class EmptyRecognizer:
            def __init__(self, **kwargs):
                pass
            def extract_entities(self, text):
                return []
        extract = bridge["_extract"]
        original = extract.__globals__["_semantica"]
        extract.__globals__["_semantica"] = lambda: (None, None, None, None, EmptyRecognizer)
        try:
            definition = {"classes": [{"id": "Author", "identityKeys": ["email"], "extractionPatterns": [r"(?<label>\w+) (?<email>\S+) (?<role>\w+)"], "fieldMappings": [{"sourceField": "email", "targetProperty": "email"}, {"sourceField": "role", "targetProperty": "role"}]}]}
            result = extract({"definition": definition, "documents": [{"sourceId": "one", "text": "Lin a@example.test editor\nLin b@example.test author\nLin a@example.test reviewer"}]})
            self.assertEqual(len(result["entities"]), 3)
            self.assertEqual(result["entities"][0]["properties"]["role"], "editor")
            self.assertTrue(any("冲突" in warning for warning in result["warnings"]))
        finally:
            extract.__globals__["_semantica"] = original


if __name__ == "__main__":
    unittest.main()
