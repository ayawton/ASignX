"""Deployment readiness exposes no capabilities and retains private API auth."""
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'server/.recognition-deps'))
sys.path.insert(0, str(ROOT / 'server/recognition'))
from fastapi.testclient import TestClient
from service import create_app


class DeploymentTests(unittest.TestCase):
    def test_readiness_is_minimal_but_capabilities_remain_private(self):
        with TestClient(create_app(factory=lambda: None, token='test-deployment-key')) as client:
            response = client.get('/health/ready')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'ready': True})
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertEqual(client.get('/capabilities').status_code, 401)

    def test_missing_internal_token_prevents_startup(self):
        with self.assertRaises(RuntimeError):
            with TestClient(create_app(factory=lambda: None, token='')):
                pass


if __name__ == '__main__':
    unittest.main()
