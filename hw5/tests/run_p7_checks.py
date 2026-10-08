"""Record actual P7 API tests and targeted MCP/financial regressions."""

from datetime import datetime, timezone
import hashlib
import json
import unittest
from backend.config import ROOT
from tests.run_checks import RecordedResult


def main():
    names = ["tests.test_p7", "tests.test_p5.MCPFinancialTests",
             "tests.test_p5.AuditAndPermissionTests"]
    before = {n: hashlib.sha256((ROOT / "data" / n).read_bytes()).hexdigest()
              for n in ("campus_customs.db", "campus_customs_new.db")}
    suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(n) for n in names)
    result = unittest.TextTestRunner(verbosity=2, resultclass=RecordedResult).run(suite)
    after = {n: hashlib.sha256((ROOT / "data" / n).read_bytes()).hexdigest() for n in before}
    evidence = {"recorded_at_utc": datetime.now(timezone.utc).isoformat(),
                "test_kind": "FastAPI TestClient + real stdio MCP + offline model doubles + disposable SQLite",
                "live_model_calls": 0, "tests_run": result.testsRun,
                "successful_tests": result.successful_tests,
                "failures": [(str(t), e) for t, e in result.failures],
                "errors": [(str(t), e) for t, e in result.errors],
                "database_hashes_before": before, "database_hashes_after": after,
                "passed": result.wasSuccessful() and before == after}
    (ROOT / "output/p7_checks.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    raise SystemExit(0 if evidence["passed"] else 1)


if __name__ == "__main__":
    main()
