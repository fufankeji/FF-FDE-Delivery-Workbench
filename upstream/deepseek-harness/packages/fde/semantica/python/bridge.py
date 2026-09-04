#!/usr/bin/env python3
"""Bounded JSON bridge from one FDE Workspace to the Semantica Python SDK."""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import re
import sys
from collections import deque
from datetime import datetime, timezone
from typing import Any


def _semantica():
    with contextlib.redirect_stdout(sys.stderr):
        import semantica
        from semantica.kg import GraphBuilder, GraphValidator
        from semantica.ontology import OntologyEngine
        from semantica.semantic_extract import NamedEntityRecognizer
    return semantica, GraphBuilder, GraphValidator, OntologyEngine, NamedEntityRecognizer


def _jsonable(value: Any) -> Any:
    if hasattr(value, "to_dict"):
        return _jsonable(value.to_dict())
    if hasattr(value, "__dict__"):
        return _jsonable(value.__dict__)
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()[:24]
    return f"{prefix}_{digest}"


def _python_pattern(pattern: str) -> str:
    """Accept the JavaScript-style named groups shown by the React editor."""
    return re.sub(r"\(\?<([A-Za-z_][A-Za-z0-9_]*)>", r"(?P<\1>", pattern)


def _health(_: dict[str, Any]) -> dict[str, Any]:
    semantica, *_ = _semantica()
    return {"version": getattr(semantica, "__version__", "unknown")}


def _ontology_dict(definition: dict[str, Any]) -> dict[str, Any]:
    base = "https://fde.local/ontology/"
    classes = []
    properties = []
    for item in definition.get("classes", []):
        class_id = item["id"]
        classes.append({
            "name": class_id,
            "uri": base + class_id,
            "label": item.get("label", class_id),
            "comment": item.get("description", ""),
            "properties": [prop["id"] for prop in item.get("properties", [])],
            "aliases": item.get("aliases", []),
            "fieldMappings": item.get("fieldMappings", []),
            "@type": "owl:Class",
        })
        for prop in item.get("properties", []):
            properties.append({
                "name": prop["id"],
                "uri": base + prop["id"],
                "label": prop.get("label", prop["id"]),
                "comment": "Project data property",
                "type": "data",
                "domain": [class_id],
                "range": "xsd:" + ({"number": "decimal", "boolean": "boolean", "date": "date", "datetime": "dateTime"}.get(prop.get("dataType"), "string")),
                "required": bool(prop.get("required", False)),
                "unique": bool(prop.get("unique", False)),
                "@type": "owl:DatatypeProperty",
            })
    for item in definition.get("relationships", []):
        properties.append({
            "name": item["id"],
            "uri": base + item["id"],
            "label": item.get("label", item["id"]),
            "comment": item.get("description", ""),
            "type": "object",
            "domain": [item["domain"]],
            "range": [item["range"]],
            "cardinality": item.get("cardinality", "many-to-many"),
            "@type": "owl:ObjectProperty",
        })
    return {
        "uri": base,
        "name": "FDEProjectOntology",
        "version": definition.get("version", "0.1.0"),
        "classes": classes,
        "properties": properties,
        "imports": [],
        "metadata": {"generated_at": datetime.now(timezone.utc).isoformat(), "source": "fde-workspace-definition"},
    }


def _publish_schema(payload: dict[str, Any]) -> dict[str, Any]:
    _, _, _, OntologyEngine, _ = _semantica()
    ontology = _ontology_dict(payload["definition"])
    with contextlib.redirect_stdout(sys.stderr):
        engine = OntologyEngine(base_uri=ontology["uri"])
        validation = engine.validate(ontology)
        shacl = engine.to_shacl(
            ontology,
            severity=payload["definition"].get("shaclSeverity", "Violation"),
            validate_output=True,
        )
    return {"ontology": ontology, "validation": _jsonable(validation), "shacl": shacl}


def _propose_schema(payload: dict[str, Any]) -> dict[str, Any]:
    _, _, _, OntologyEngine, _ = _semantica()
    candidates = payload["candidates"]
    entities = [{
        "id": item["id"], "name": item["label"], "type": item["type"],
        **({"properties": item.get("properties", {})} if item.get("properties") else {}),
    } for item in candidates.get("entities", []) if item.get("decision") != "rejected"]
    relationships = [{
        "source": item["source"], "target": item["target"], "type": item["type"]
    } for item in candidates.get("relationships", []) if item.get("decision") != "rejected"]
    with contextlib.redirect_stdout(sys.stderr):
        ontology = OntologyEngine(min_occurrences=1).from_data(
            {"entities": entities, "relationships": relationships},
            name="FDEProjectOntology", min_occurrences=1,
        )
    return {"ontology": _jsonable(ontology)}


def _extract(payload: dict[str, Any]) -> dict[str, Any]:
    _, _, _, _, NamedEntityRecognizer = _semantica()
    definition = payload.get("definition", {})
    classes = definition.get("classes", [])
    relationships = definition.get("relationships", [])
    entities: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    with contextlib.redirect_stdout(sys.stderr):
        recognizer = NamedEntityRecognizer(method="pattern", methods=["pattern"], confidence_threshold=0.1)

    def add_entity(label: str, entity_type: str, confidence: float, source_id: str, summary: str = "", properties: dict[str, Any] | None = None) -> str:
        clean = " ".join(label.split()).strip(" \t\r\n,.;:，。；：")
        if not clean:
            return ""
        key = _stable_id("ent", entity_type.casefold(), clean.casefold())
        current = entities.get(key)
        if current is None:
            entities[key] = {
                "id": key, "label": clean, "type": entity_type,
                "summary": summary[:600], "confidence": max(0.0, min(1.0, confidence)),
                "sourceRefs": [source_id], "properties": properties or {}, "decision": "pending",
            }
        else:
            current["confidence"] = max(current["confidence"], confidence)
            if source_id not in current["sourceRefs"]:
                current["sourceRefs"].append(source_id)
            if properties:
                current["properties"].update(properties)
        return key

    for document in payload.get("documents", []):
        source_id = document["sourceId"]
        text = document.get("text", "")
        for class_def in classes:
            for pattern in class_def.get("extractionPatterns", []):
                try:
                    for match in re.finditer(_python_pattern(pattern), text, re.MULTILINE):
                        groups = match.groupdict()
                        label = groups.get("label") or (match.group(1) if match.groups() else match.group(0))
                        mappings = {
                            mapping["targetProperty"]: groups[mapping["sourceField"]]
                            for mapping in class_def.get("fieldMappings", [])
                            if groups.get(mapping.get("sourceField")) not in (None, "")
                        }
                        add_entity(label, class_def["id"], 0.82, source_id, match.group(0), mappings)
                except re.error as exc:
                    warnings.append(f"{class_def['id']} 的抽取规则无效：{exc}")
        try:
            with contextlib.redirect_stdout(sys.stderr):
                recognized = recognizer.extract_entities(text[:200000])
            allowed_types = {
                alias.casefold(): item["id"]
                for item in classes
                for alias in [item["id"], item.get("label", item["id"]), *item.get("aliases", [])]
            }
            for item in recognized:
                raw_type = str(getattr(item, "label", "Entity"))
                entity_type = allowed_types.get(raw_type.casefold(), raw_type)
                if allowed_types and raw_type.casefold() not in allowed_types:
                    continue
                add_entity(str(getattr(item, "text", "")), entity_type, float(getattr(item, "confidence", 0.5)), source_id)
        except Exception as exc:  # Semantica diagnostics remain visible without losing custom-pattern results.
            warnings.append(f"{document.get('name', source_id)} 的 Semantica 实体抽取失败：{exc}")

    by_label: dict[str, str] = {item["label"].casefold(): item["id"] for item in entities.values()}
    relation_items: dict[str, dict[str, Any]] = {}
    for document in payload.get("documents", []):
        source_id = document["sourceId"]
        text = document.get("text", "")
        for rel_def in relationships:
            for pattern in rel_def.get("extractionPatterns", []):
                try:
                    for match in re.finditer(_python_pattern(pattern), text, re.MULTILINE):
                        groups = match.groupdict()
                        source_label = " ".join(groups.get("source", "").split()).casefold()
                        target_label = " ".join(groups.get("target", "").split()).casefold()
                        source = by_label.get(source_label)
                        target = by_label.get(target_label)
                        if source is None or target is None:
                            warnings.append(f"关系 {rel_def['id']} 找到文本匹配，但端点尚未成为候选实体。")
                            continue
                        key = _stable_id("rel", source, rel_def["id"], target)
                        current = relation_items.get(key)
                        if current is None:
                            relation_items[key] = {
                                "id": key, "source": source, "target": target, "type": rel_def["id"],
                                "label": rel_def.get("label", rel_def["id"]), "confidence": 0.78,
                                "sourceRefs": [source_id], "decision": "pending",
                            }
                        elif source_id not in current["sourceRefs"]:
                            current["sourceRefs"].append(source_id)
                except re.error as exc:
                    warnings.append(f"{rel_def['id']} 的关系规则无效：{exc}")
    if not entities:
        warnings.append("当前材料没有产生可用候选。请补充适合当前语言和领域的抽取规则，或由 Agent 提交经证据核对的候选知识。")
    return {"entities": list(entities.values()), "relationships": list(relation_items.values()), "warnings": warnings}


def _build(payload: dict[str, Any]) -> dict[str, Any]:
    _, GraphBuilder, GraphValidator, _, _ = _semantica()
    entities = [{
        "id": item["id"], "name": item["label"], "type": item["type"],
        "confidence": item.get("confidence", 1.0), "sourceRefs": item.get("sourceRefs", []),
        "summary": item.get("summary", ""), "validFrom": item.get("validFrom"),
        "validUntil": item.get("validUntil"), "properties": item.get("properties", {}),
    } for item in payload["entities"]]
    relationships = [{
        "id": item["id"], "source": item["source"], "target": item["target"], "type": item["type"],
        "label": item.get("label", item["type"]), "confidence": item.get("confidence", 1.0),
        "sourceRefs": item.get("sourceRefs", []), "validFrom": item.get("validFrom"),
        "validUntil": item.get("validUntil"),
    } for item in payload["relationships"]]
    with contextlib.redirect_stdout(sys.stderr):
        graph = GraphBuilder(
            merge_entities=False, resolve_conflicts=False, enable_temporal=True, track_history=True,
        ).build({"entities": entities, "relationships": relationships}, extract=False)
        validation = GraphValidator(schema={
            "entity_types": [item["id"] for item in payload["definition"].get("classes", [])],
            "relationship_types": [item["id"] for item in payload["definition"].get("relationships", [])],
        }).validate(graph)
    return {"graph": _jsonable(graph), "validation": _jsonable(validation)}


def _query_question(graph: dict[str, Any], question: dict[str, Any]) -> dict[str, Any]:
    query = question.get("query", {})
    nodes = graph.get("entities", [])
    edges = graph.get("relationships", [])
    by_id = {str(node.get("id")): node for node in nodes}
    source_type = query.get("sourceType")
    target_type = query.get("targetType")
    relation_type = query.get("relationshipType")
    kind = query.get("kind", "lookup")
    node_ids: set[str] = set()
    edge_ids: set[str] = set()
    if kind == "lookup":
        node_ids = {str(node.get("id")) for node in nodes if not source_type or node.get("type") == source_type}
    elif kind == "edge":
        for edge in edges:
            source = by_id.get(str(edge.get("source")))
            target = by_id.get(str(edge.get("target")))
            if source is None or target is None:
                continue
            if relation_type and edge.get("type") != relation_type:
                continue
            if source_type and source.get("type") != source_type:
                continue
            if target_type and target.get("type") != target_type:
                continue
            node_ids.update((str(source.get("id")), str(target.get("id"))))
            edge_ids.add(str(edge.get("id", _stable_id("edge", str(source.get("id")), str(target.get("id"))))))
    else:
        adjacency: dict[str, list[tuple[str, str]]] = {}
        for edge in edges:
            if relation_type and edge.get("type") != relation_type:
                continue
            source = str(edge.get("source")); target = str(edge.get("target"))
            edge_id = str(edge.get("id", _stable_id("edge", source, target)))
            adjacency.setdefault(source, []).append((target, edge_id))
        starts = [str(node.get("id")) for node in nodes if not source_type or node.get("type") == source_type]
        max_depth = max(1, min(8, int(query.get("maxDepth", 2))))
        for start in starts:
            queue = deque([(start, 0, [])]); seen = {start}
            while queue:
                current, depth, path_edges = queue.popleft()
                node = by_id.get(current)
                if depth > 0 and node is not None and (not target_type or node.get("type") == target_type):
                    node_ids.update((start, current)); edge_ids.update(path_edges)
                if depth >= max_depth:
                    continue
                for target, edge_id in adjacency.get(current, []):
                    if target not in seen:
                        seen.add(target); queue.append((target, depth + 1, path_edges + [edge_id]))
    source_refs: set[str] = set()
    for node_id in node_ids:
        source_refs.update(str(item) for item in by_id.get(node_id, {}).get("sourceRefs", []))
    for edge in edges:
        edge_id = str(edge.get("id", ""))
        if edge_id in edge_ids:
            source_refs.update(str(item) for item in edge.get("sourceRefs", []))
    answer_count = len(edge_ids) if kind in ("edge", "path") else len(node_ids)
    minimum = max(1, int(query.get("minAnswers", 1)))
    passed = answer_count >= minimum
    return {
        "questionId": question["id"], "status": "passed" if passed else "failed",
        "answerCount": answer_count, "nodeIds": sorted(node_ids), "edgeIds": sorted(edge_ids),
        "sourceRefs": sorted(source_refs),
        "message": f"真实查询返回 {answer_count} 项，要求至少 {minimum} 项。",
    }


def _validate(payload: dict[str, Any]) -> dict[str, Any]:
    _, _, GraphValidator, _, _ = _semantica()
    graph = payload["graph"]
    definition = payload["definition"]
    with contextlib.redirect_stdout(sys.stderr):
        result = GraphValidator(schema={
            "entity_types": [item["id"] for item in definition.get("classes", [])],
            "relationship_types": [item["id"] for item in definition.get("relationships", [])],
        }, strict=False).validate(graph)
    questions = [_query_question(graph, item) for item in definition.get("competencyQuestions", [])]
    return {"structural": _jsonable(result), "questions": questions}


def _context(payload: dict[str, Any]) -> dict[str, Any]:
    graph = payload["graph"]
    definition = payload["definition"]
    seed = payload.get("seedNodeId")
    question_id = payload.get("questionId")
    question = next((item for item in definition.get("competencyQuestions", []) if item.get("id") == question_id), None)
    selected_nodes: set[str] = set()
    selected_edges: set[str] = set()
    if question is not None:
        answer = _query_question(graph, question)
        selected_nodes.update(answer["nodeIds"]); selected_edges.update(answer["edgeIds"])
    if seed:
        selected_nodes.add(seed)
        frontier = {seed}
        for _ in range(max(0, min(3, int(payload.get("maxDepth", 1))))):
            next_frontier: set[str] = set()
            for edge in graph.get("relationships", []):
                source = str(edge.get("source")); target = str(edge.get("target"))
                if source in frontier or target in frontier:
                    selected_edges.add(str(edge.get("id", "")))
                    if source not in selected_nodes: next_frontier.add(source)
                    if target not in selected_nodes: next_frontier.add(target)
                    selected_nodes.update((source, target))
            frontier = next_frontier
    threshold = float(payload.get("minConfidence", definition.get("confidenceThreshold", 0.6)))
    nodes = [item for item in graph.get("entities", []) if str(item.get("id")) in selected_nodes and float(item.get("confidence", 1.0)) >= threshold]
    allowed = {str(item.get("id")) for item in nodes}
    edges = [item for item in graph.get("relationships", []) if str(item.get("id", "")) in selected_edges and str(item.get("source")) in allowed and str(item.get("target")) in allowed and float(item.get("confidence", 1.0)) >= threshold]
    sources = sorted({str(ref) for item in nodes + edges for ref in item.get("sourceRefs", [])})
    constraints = [item.get("description", item.get("label", item.get("id", ""))) for item in definition.get("provenanceRules", []) + definition.get("temporalRules", [])]
    return {"entities": nodes, "relationships": edges, "sources": sources, "constraints": constraints, "derivedFacts": []}


OPERATIONS = {
    "health": _health,
    "extract": _extract,
    "propose-schema": _propose_schema,
    "publish-schema": _publish_schema,
    "build": _build,
    "validate": _validate,
    "context": _context,
}


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in OPERATIONS:
        raise ValueError("unsupported Semantica bridge operation")
    payload = json.load(sys.stdin)
    result = OPERATIONS[sys.argv[1]](payload)
    json.dump({"ok": True, "value": result}, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        json.dump({"ok": False, "error": {"type": type(exc).__name__, "message": str(exc)}}, sys.stdout, ensure_ascii=False)
        sys.exit(1)
