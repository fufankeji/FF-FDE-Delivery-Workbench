from pathlib import Path


def test_sandbox_scripts_prohibit_host_path_traversal() -> None:
    script = Path("scripts/run-sandbox.sh").read_text(encoding="utf-8")
    assert "--network none" in script
    assert "--read-only" in script
    assert "--cap-drop ALL" in script
    assert "--security-opt no-new-privileges" in script
    assert '"${script}" == *".."*' in script
