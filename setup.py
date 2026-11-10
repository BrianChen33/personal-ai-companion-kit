"""Ship the canonical plugins/ sources in wheels without a maintained second copy."""
from pathlib import Path
import json
from setuptools import setup
from setuptools.command.build_py import build_py


class BuildWithPlugins(build_py):
    def run(self):
        super().run()
        for manifest in sorted(Path('plugins').glob('*/manifest.json')):
            data = json.loads(manifest.read_text(encoding='utf-8'))
            destination = Path(self.build_lib) / 'personal_bot' / 'bundled_plugins' / data['id']
            for name in ['manifest.json', *data['files']]:
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                self.copy_file(str(manifest.parent / name), str(target))


setup(cmdclass={'build_py': BuildWithPlugins})
