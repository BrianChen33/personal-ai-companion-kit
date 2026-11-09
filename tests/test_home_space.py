"""Synthetic acceptance for opt-in asynchronous home publication."""
import json
import base64
import gzip
from pathlib import Path
import sys
import tempfile
import unittest

from personal_bot import deploy
sys.path.insert(0, str(deploy.RUNTIME))
from brain import Brain
from muse_ext import home_space as home
from muse_ext import home_relay


class HomeSpace(unittest.TestCase):
    def test_program_relay_publishes_once_and_keeps_credentials_out_of_the_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'brain'
            deploy.init(root)
            deploy.enable(root, list(deploy.DEFAULT_FEATURES))
            config = Path(folder) / 'relay.json'
            config.write_text(json.dumps({'credentials_file': str(Path(folder) / 'credentials.json'),
                'ioredis_module': 'synthetic-ioredis', 'sender_path': 'synthetic-sender',
                'key': 'synthetic:home'}))
            home.write(root, 'binding', {'enabled': True, 'space': 'synthetic-home'})
            home.mark(root, 'companion_commit')
            calls = []

            def receive(config, command):
                value = json.loads(command[5])
                self.assertEqual(command[4], command[3] + ':head')
                self.assertEqual(json.loads(command[8])['revision'], value['revision'])
                snapshot = json.loads(gzip.decompress(base64.b64decode(value['data'])))
                self.assertEqual(value['revision'], snapshot['revision'])
                self.assertEqual(value['schema'], home_relay.SCHEMA)
                self.assertNotIn('synthetic-private-token', json.dumps(snapshot))
                calls.append(command)
                return ['stored', value['revision'], value['sha256']]

            self.assertEqual(home_relay.publish(root, config, receive)['status'], 'stored')
            self.assertEqual(home_relay.publish(root, config, receive)['status'], 'unchanged')
            self.assertEqual(len(calls), 1)

    def test_disabled_marker_and_read_only_calls_do_not_wake(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            home.mark(root, 'companion_commit')
            self.assertFalse(home.path(root, 'dirty').exists())
            self.assertEqual(home.probe(root)['reason'], 'disabled')

    def test_retry_receipt_and_new_change_during_publication(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            deploy.init(root)
            deploy.enable(root, list(deploy.DEFAULT_FEATURES))
            home.write(root, 'binding', {'enabled': True, 'space': 'synthetic-private-home'})
            b = Brain(root)
            try:
                b.dispatch({'op': 'companion_day', 'action': 'status'})
                self.assertFalse(home.path(root, 'dirty').exists())
            finally:
                b.close()
            home.mark(root, 'companion_commit')
            self.assertTrue(home.probe(root, now=100)['wake'])
            self.assertFalse(home.probe(root, now=101)['wake'])
            self.assertTrue(home.probe(root, now=221)['wake'])
            outbox = home.capture(root)
            self.assertNotIn('panel_art', outbox['snapshot'])
            self.assertLess(len(json.dumps(outbox).encode()), 256000)
            with self.assertRaises(ValueError):
                home.acknowledge(root, outbox['snapshot']['revision'], 'wrong')
            home.mark(root, 'companion_tick')
            home.acknowledge(root, outbox['snapshot']['revision'], outbox['sha256'])
            self.assertTrue(home.probe(root, now=222)['wake'])
            latest = home.capture(root)
            home.acknowledge(root, latest['snapshot']['revision'], latest['sha256'])
            self.assertFalse(home.probe(root, now=223)['wake'])


if __name__ == '__main__':
    unittest.main()
