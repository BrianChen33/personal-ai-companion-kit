"""Portable host integration with real isolated state, no network or sender."""
import copy
import json
import shutil
import subprocess
import sys
import unittest

from personal_bot import deploy
import test_lean_entry as fixture


@unittest.skipUnless(shutil.which('node'), 'Node is not installed')
class HostAdapters(unittest.TestCase):
    setUp = fixture.LeanEntry.setUp
    tearDown = fixture.LeanEntry.tearDown
    requests = fixture.LeanEntry.requests
    count = fixture.LeanEntry.count

    def envelope(self, host='fixture:portable', chat='fixture:direct'):
        return dict(schema='companion-host-messages-v1', host_id=host,
                    conversation_id=chat, conversation_type='direct', messages=[
                        dict(id='human-message/1', sequence=11, role='user',
                             sender_id='fixture:owner', text='  Synthetic original\nkept intact.  ',
                             occurred_at_ms=1700000001000)])

    def call(self, binding=None, env=None, entry='reply_driver.mjs', **request):
        binding = {'host_id': 'fixture:portable', 'owner_id': 'fixture:owner',
                   'chat_id': 'fixture:direct', **(binding or {})}
        args = [shutil.which('node'), str(deploy.RUNTIME/entry), '--root', str(self.workspace),
                '--adapter', 'portable', '--host-id', binding['host_id'],
                '--owner-id', binding['owner_id'], '--chat-id', binding['chat_id']]
        result = subprocess.run(args, input=json.dumps(request), encoding='utf-8',
                                capture_output=True, env=env or self.env)
        self.assertTrue(result.stdout.strip(), result.stderr)
        return result.returncode, json.loads(result.stdout)

    def test_portable_roundtrip_preserves_original_and_reuses_one_appraisal(self):
        payload = self.envelope()
        code, context = self.call(phase='context', host_response=payload)
        self.assertEqual(code, 0, context)
        assessment = context['context']['emotion_template']
        self.assertEqual(assessment['format'], 'compact48-v1')
        assessment['emotion_deltas']['好奇'] = .01
        code, committed = self.call(phase='commit', ticket=context['ticket'],
                                    emotion_assessment=assessment)
        self.assertEqual(code, 0, committed)
        self.assertTrue(committed['ready_to_send'])
        self.assertNotIn('context', committed)
        code, replay = self.call(phase='commit', ticket=context['ticket'],
                                 emotion_assessment=assessment)
        self.assertEqual(code, 0, replay)
        self.assertEqual(committed['decision']['roll'], replay['decision']['roll'])
        self.assertEqual(self.count('ct_appraisal'), 1)
        self.assertEqual(self.requests()[0]['text'], payload['messages'][0]['text'])
        self.assertEqual(self.requests()[0]['occurred_at'], 1700000001)
        self.assertEqual([q['op'] for q in self.requests()],
                         ['prepare', 'companion_commit', 'companion_commit'])
        self.assertTrue(context['turnId'].startswith('host:v1:'))
        code, finished = self.call(phase='finish', ticket=context['ticket'],
                                   receipt='fixture:actual-text-receipt', outcome='text_only',
                                   text_finished=True)
        self.assertEqual(code, 0, finished)

    def test_untrusted_binding_and_ambiguous_messages_fail_before_capture(self):
        invalid = []
        for field, value in [('host_id', 'foreign'), ('conversation_id', 'foreign'),
                             ('conversation_type', 'group'), ('schema', 'unknown')]:
            payload = self.envelope(); payload[field] = value; invalid.append(payload)
        for field, value in [('sender_id', 'foreign'), ('text', {'image': 'fixture'}),
                             ('sequence', 1.5), ('occurred_at_ms', 'yesterday'),
                             ('attachments', [{'id': 'fixture'}])]:
            payload = self.envelope(); payload['messages'][0][field] = value; invalid.append(payload)
        payload = self.envelope(); payload['messages'].append(copy.deepcopy(payload['messages'][0]))
        invalid.append(payload)
        payload = self.envelope(); duplicate = copy.deepcopy(payload['messages'][0]); duplicate['sequence'] = 12
        payload['messages'].append(duplicate); invalid.append(payload)
        for payload in invalid:
            with self.subTest(payload=payload):
                code, result = self.call(phase='context', host_response=payload)
                self.assertNotEqual(code, 0, result)
                self.assertFalse(result.get('ready_to_send', False))
        self.assertEqual(self.requests(), [])

    def test_blank_payload_is_ignored_and_does_not_block_later_text(self):
        payload = self.envelope(); payload['messages'][0]['text'] = ' \n\t '
        code, ignored = self.call(phase='context', host_response=payload)
        self.assertEqual(code, 0, ignored)
        self.assertEqual(ignored['event'], 'empty_user_input_ignored')
        self.assertNotIn('ticket', ignored)
        self.assertEqual(self.requests(), [])
        code, normal = self.call(phase='context', host_response=self.envelope())
        self.assertEqual(code, 0, normal)

    def test_namespace_and_tickets_bind_host_owner_and_conversation(self):
        code, first = self.call(phase='context', host_response=self.envelope())
        self.assertEqual(code, 0, first)
        second_binding = dict(host_id='fixture:other', owner_id='fixture:owner', chat_id='fixture:direct')
        code, second = self.call(binding=second_binding, phase='context',
                                 host_response=self.envelope(host='fixture:other'))
        self.assertEqual(code, 0, second)
        self.assertNotEqual(first['turnId'], second['turnId'])
        for binding in [second_binding,
                        dict(host_id='fixture:portable', owner_id='other-owner', chat_id='fixture:direct'),
                        dict(host_id='fixture:portable', owner_id='fixture:owner', chat_id='other-chat')]:
            code, rejected = self.call(binding=binding, phase='commit', ticket=first['ticket'],
                                      emotion_assessment=first['context']['emotion_template'])
            self.assertNotEqual(code, 0, rejected)
        self.assertEqual(self.count('ct_appraisal'), 0)

    def test_fresh_input_and_remembered_head_reject_older_ticket(self):
        _, old = self.call(phase='context', host_response=self.envelope())
        payload = self.envelope()
        payload['messages'].append(dict(id='human-message/2', sequence=12, role='user',
            sender_id='fixture:owner', text='A new fixture input.', occurred_at_ms=1700000002000))
        code, rejected = self.call(phase='commit', host_response=payload, ticket=old['ticket'],
                                  emotion_assessment=old['context']['emotion_template'])
        self.assertNotEqual(code, 0, rejected)
        code, newer = self.call(phase='context', host_response=payload)
        self.assertEqual(code, 0, newer)
        code, rejected = self.call(phase='commit', ticket=old['ticket'],
                                  emotion_assessment=old['context']['emotion_template'])
        self.assertNotEqual(code, 0, rejected)
        self.assertEqual(self.count('ct_appraisal'), 0)

    def test_feedback_keeps_assistant_output_separate_from_user_stimulus(self):
        payload = self.envelope()
        payload['messages'].append(dict(id='assistant-message/1', sequence=12, role='assistant',
            sender_id='fixture:bot', text='An actual-shape synthetic reply.', occurred_at_ms=1700000002000))
        code, result = self.call(entry='host_entry.mjs', phase='feedback', host_response=payload)
        self.assertEqual(code, 0, result)
        request = self.requests()[0]
        self.assertEqual(request['op'], 'companion_feedback')
        self.assertEqual(len(request['native_events']), 1)
        self.assertEqual(len(request['native_outputs']), 1)
        self.assertEqual(request['native_events'][0]['text'], payload['messages'][0]['text'])
        self.assertEqual(self.count('ct_appraisal'), 0)

    def test_rejected_fresh_snapshot_cannot_be_forgotten_by_bare_ticket_retry(self):
        _, old = self.call(phase='context', host_response=self.envelope())
        fresh = self.envelope()
        fresh['messages'].append(dict(id='human-message/2', sequence=12, role='user',
            sender_id='fixture:owner', text='A new fixture input.', occurred_at_ms=1700000002000))
        code, rejected = self.call(phase='commit', ticket=old['ticket'], host_response=fresh,
                                  emotion_assessment=old['context']['emotion_template'])
        self.assertNotEqual(code, 0, rejected)
        code, retry = self.call(phase='commit', ticket=old['ticket'],
                               emotion_assessment=old['context']['emotion_template'])
        self.assertNotEqual(code, 0, retry)
        self.assertEqual(self.count('ct_appraisal'), 0)
        self.assertEqual([q['op'] for q in self.requests()], ['prepare'])

    def test_external_runtime_dependency_change_invalidates_ticket(self):
        external = self.workspace/'external runtime'
        shutil.copytree(deploy.RUNTIME, external, ignore=shutil.ignore_patterns('__pycache__'))
        env = dict(self.env, COMPANION_BRAIN_SCRIPT=str(external/'brain.py'))
        code, context = self.call(env=env, phase='context', host_response=self.envelope())
        self.assertEqual(code, 0, context)
        module = external/'muse_ext/emotion.py'
        with module.open('a', encoding='utf-8') as output:
            output.write('\n# isolated dependency-version change\n')
        code, rejected = self.call(env=env, phase='commit', ticket=context['ticket'],
                                  emotion_assessment=context['context']['emotion_template'])
        self.assertNotEqual(code, 0, rejected)
        self.assertEqual(rejected['error'], 'source_ticket_stale_or_changed')
        self.assertEqual(self.count('ct_appraisal'), 0)

    def test_generic_paths_work_without_muse_directory_or_copied_runtime(self):
        state = self.workspace/'private state'
        deploy.init(state); deploy.enable(state, list(deploy.DEFAULT_FEATURES))
        env = {k: v for k, v in self.env.items() if not k.startswith('STICKER_')}
        env.update(COMPANION_BRAIN_ROOT=str(state), COMPANION_PYTHON=sys.executable)
        # Core-only setup explicitly disables the existing optional sticker path.
        (self.workspace/'stickers/config.json').unlink()
        env['STICKERS_ENABLED'] = '0'
        self.assertFalse((state/'brain.py').exists())
        code, context = self.call(env=env, phase='context', host_response=self.envelope())
        self.assertEqual(code, 0, context)
        code, committed = self.call(env=env, phase='commit', ticket=context['ticket'],
                                    emotion_assessment=context['context']['emotion_template'])
        self.assertEqual(code, 0, committed)
        self.assertTrue(committed['ready_to_send'])
        self.assertEqual(committed['decision']['mode'], 'disabled')


if __name__ == '__main__':
    unittest.main()
