"""Thin optional entries over existing implementations, not parallel data stores."""

ENTRYPOINTS = {
    'stickers': 'runtime/reply_driver.mjs -> sticker_main.mjs; private catalogue + native image sender',
    'qq': 'runtime/qq-adapter.mjs; docs/QQ_TRANSPORT.md; owner-bound transport required',
    'wechat': 'host-owned WeChat transport is not distributed in this kit; manual integration only',
    'github-vault': 'python -m personal_bot.vault; private repository authorization required',
    'home-space': 'python -m muse_ext.home_space; docs/HOME_SPACE.md; native private Space required',
    'dashboard': 'companion_panel; existing emotion heartbeat only',
    'memes': 'meme_* requests; weekly meme-sync only',
}


def dispatch(b, pid, q):
    from muse_ext.capabilities import require
    require(b, pid)
    action = q.get('action', 'status')
    if action == 'status':
        return dict(ok=True, plugin=pid, entrypoint=ENTRYPOINTS[pid],
                    host_binding_verified=False, creates_service=False)
    if pid == 'dashboard' and action == 'render':
        return b.dispatch(dict(op='companion_panel', scope='owner-private'))
    if pid == 'memes' and action == 'request':
        request = q.get('request', {})
        if request.get('op') not in ('meme_search', 'meme_learn', 'meme_feedback', 'meme_record_use',
                                     'meme_preference', 'companion_expression_config', 'companion_meme_status'):
            raise ValueError('unsupported_meme_operation')
        if request.get('scope', 'owner-private') != 'owner-private':
            raise ValueError('plugin_owner_admin_only')
        return b.dispatch(dict(request, scope='owner-private'))
    if pid == 'home-space':
        from muse_ext import home_space
        if action == 'probe':
            return dict(ok=True, **home_space.probe(b.root))
        if action == 'capture':
            return dict(ok=True, **home_space.capture(b.root))
        if action == 'ack':
            return home_space.acknowledge(b.root, q.get('revision'), q.get('sha256'))
    raise ValueError('host_native_binding_required_or_unknown_action')
