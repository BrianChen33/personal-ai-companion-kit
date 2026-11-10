"""Build/install a wheel and exercise it with no checkout on the import path."""
import json,os,shutil,subprocess,sys,tempfile,venv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run(argv,cwd,env):
    p=subprocess.run(list(map(str,argv)),cwd=cwd,env=env,check=True)

def main():
    env=os.environ.copy();env.pop('PYTHONPATH',None);env['PYTHONUTF8']='1'
    with tempfile.TemporaryDirectory(prefix='personal-memory-wheel-') as temp:
        work=Path(temp).resolve();wheels=work/'wheels';wheels.mkdir()
        run([sys.executable,'-m','pip','wheel','--no-deps','--wheel-dir',wheels,ROOT],work,env)
        venv.EnvBuilder(with_pip=True).create(work/'venv')
        py=work/'venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
        wheel=next(wheels.glob('personal_ai_companion_kit-*.whl'))
        run([py,'-m','pip','install','--no-deps',wheel],work,env)
        run([py,'-c','from pathlib import Path; import personal_bot,sys; assert Path(personal_bot.__file__).is_relative_to(Path(sys.prefix)); print("installed package origin verified")'],work,env)
        installed=subprocess.run([str(py),'-c','from personal_bot import deploy; print(deploy.RUNTIME)'],cwd=work,env=env,capture_output=True,text=True,check=True)
        installed_runtime=Path(installed.stdout.strip())
        for entry in ('main_entry_guard.mjs','main_native_entry.mjs','reply_driver.mjs','reply_media.mjs',
                      'host_entry.mjs','host_message_adapter.mjs','host_runtime.mjs'):
            if not (installed_runtime/entry).is_file():raise RuntimeError('installed main entry component missing')
        if shutil.which('node'):
            run(['node',installed_runtime/'main_native_entry.mjs','--help'],work,env)
            run(['node',installed_runtime/'reply_driver.mjs','--help'],work,env)
            run(['node',installed_runtime/'host_entry.mjs','--help'],work,env)
        run([py,'-m','personal_bot','self-test'],work,env)
        run([py,'-c',
             'from personal_bot import onboarding; from pathlib import Path; '
             'ids=[p["id"] for p in onboarding.catalogue()["plugins"] if p["status"]=="available"]; '
             'r=onboarding.apply(Path("managed-state"),ids); '
             'assert r["status"]=="prepared" and not r["enabled"]; '
             'print("All available plugins installed from wheel, disabled")'],work,env)
        state=work/'state with spaces'
        run([py,'-m','personal_bot','--root',state,'init'],work,env)
        run([py,'-m','personal_bot','--root',state,'enable'],work,env)
        run([py,'-m','personal_bot','--root',state,'doctor'],work,env)
        if shutil.which('node'):
            host_env={k:v for k,v in env.items() if not k.startswith(('STICKER_','COMPANION_'))}
            host_env.update(COMPANION_BRAIN_ROOT=str(state),COMPANION_PYTHON=str(py),STICKERS_ENABLED='0')
            driver=['node',str(installed_runtime/'reply_driver.mjs'),'--root',str(work/'host workspace'),
                    '--adapter','portable','--host-id','wheel-host','--owner-id','wheel-owner',
                    '--chat-id','wheel-direct']
            def invoke(request):
                result=subprocess.run(driver,input=json.dumps(request),cwd=work,env=host_env,
                                      capture_output=True,text=True,encoding='utf-8')
                output=json.loads(result.stdout)
                if result.returncode or not output.get('ok'):
                    raise RuntimeError({key:output.get(key) for key in ('error','formal_entry','decision')})
                return output
            context=invoke(dict(phase='context',host_response=dict(
                schema='companion-host-messages-v1',host_id='wheel-host',
                conversation_id='wheel-direct',conversation_type='direct',messages=[dict(
                    id='wheel-message-1',sequence=1,role='user',sender_id='wheel-owner',
                    text='Isolated installed-wheel message.',occurred_at_ms=1700000000123)])))
            committed=invoke(dict(phase='commit',ticket=context['ticket'],media=False,
                                  emotion_assessment=context['context']['emotion_template']))
            if not committed.get('ready_to_send'):raise RuntimeError('installed portable commit failed')
            if (state/'brain.py').exists():raise RuntimeError('portable install copied a runtime into state')
            print('Installed portable context/commit accepted; no real send attempted.')
        request_file=work/'panel-request.json'
        request_file.write_text(json.dumps({'op':'companion_panel','scope':'owner-private'}),encoding='utf-8')
        run([py,'-m','personal_bot','--root',state,'request','--file',request_file],work,env)
        if not (state/'exports/Companion面板.html').is_file():raise RuntimeError('installed HTML template missing')
        for request in [dict(op='companion_expression_config',scope='owner-private',patch=dict(emotion_gain=2,banter_level=50)),
                        dict(op='meme_search',scope='owner-private',text='isolated wheel fixture'),
                        dict(op='companion_panel')]:
            request_file.write_text(json.dumps(request),encoding='utf-8')
            run([py,'-m','personal_bot','--root',state,'request','--file',request_file],work,env)
        html=(state/'exports/Companion面板.html').read_text(encoding='utf-8')
        snapshot=json.loads(html.split('id="snapshot">')[1].split('</script>')[0])
        if snapshot['expression_settings']['values']['emotion_gain']!=2:raise RuntimeError('installed humor settings not in panel')
        if snapshot['plugins']['items'] or (state/'extensions').exists():raise RuntimeError('core unexpectedly installed an optional plugin')
        run([py,'-m','personal_bot','--root',state,'plugin','install','--source',ROOT/'plugins/social-reading'],work,env)
        run([py,'-m','personal_bot','--root',state,'plugin','enable','--id','social-reading'],work,env)
        request_file.write_text(json.dumps(dict(op='companion_panel')),encoding='utf-8')
        run([py,'-m','personal_bot','--root',state,'request','--file',request_file],work,env)
        html=(state/'exports/Companion面板.html').read_text(encoding='utf-8')
        snapshot=json.loads(html.split('id="snapshot">')[1].split('</script>')[0])
        if snapshot['plugins']['items'][0]['status']!='awaiting_sources':raise RuntimeError('optional plugin onboarding was skipped')
        if 'data-detail="plugins"' not in html:raise RuntimeError('installed panel lacks optional plugin card')
        run([py,'-m','personal_bot','--root',state,'meme-sync','--help'],work,env)
    print('Wheel accepted outside checkout; synthetic state cleaned.')

if __name__=='__main__':main()
