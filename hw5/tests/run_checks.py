"""Write evidence from actual offline integration tests, not invented results."""

from datetime import datetime, timezone
import hashlib
import json
import unittest
from backend.config import ROOT


class RecordedResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.successful_tests = []

    def addSuccess(self, test):
        self.successful_tests.append(test.id())
        super().addSuccess(test)


def main():
    hashes_before = {name: hashlib.sha256((ROOT / "data" / name).read_bytes()).hexdigest()
                     for name in ("campus_customs.db", "campus_customs_new.db")}
    suite = unittest.defaultTestLoader.loadTestsFromName("tests.test_p5")
    result = unittest.TextTestRunner(verbosity=2, resultclass=RecordedResult).run(suite)
    hashes_after = {name: hashlib.sha256((ROOT / "data" / name).read_bytes()).hexdigest()
                    for name in hashes_before}
    evidence = {"recorded_at_utc": datetime.now(timezone.utc).isoformat(),
                "test_kind": "Offline model doubles with real stdio MCP and disposable SQLite copies",
                "live_model_calls": 0, "tests_run": result.testsRun,
                "successful_tests": result.successful_tests,
                "failures": [(str(test), error) for test, error in result.failures],
                "errors": [(str(test), error) for test, error in result.errors],
                "skipped": [(str(test), reason) for test, reason in result.skipped],
                "database_hashes_before": hashes_before, "database_hashes_after": hashes_after,
                "passed": result.wasSuccessful() and hashes_before == hashes_after}
    (ROOT / "output/p5_checks.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    raise SystemExit(0 if evidence["passed"] else 1)


if __name__ == "__main__":
    main()
