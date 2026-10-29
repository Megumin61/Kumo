from pathlib import Path
import hashlib, json, zipfile, subprocess

root=Path(__file__).resolve().parents[1]
dist=root/'dist'
dist.mkdir(exist_ok=True)
ignored={'.git','node_modules','dist','deliverables','__pycache__'}
forbidden={'local-config.json','bridge-config.json','.env'}
public_files=set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode('utf-8').split('\0'))
browser_version=json.loads((root/'browser-extension/manifest.json').read_text(encoding='utf-8'))['version']
plugin_version=json.loads((root/'plugins/kumo/plugin.json').read_text(encoding='utf-8'))['version']
def entries(folder):
    return sorted(p for p in folder.rglob('*') if p.is_file() and p.relative_to(root).as_posix() in public_files and not any(x in ignored for x in p.relative_to(root).parts) and p.name not in forbidden and not (p.name.startswith('.env.') and p.name!='.env.example'))
def archive(name, pairs):
    dest=dist/name
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for source,rel in pairs:
            z.write(source,str(rel).replace('\\','/'))
    with zipfile.ZipFile(dest) as z:
        if z.testzip(): raise RuntimeError('Archive verification failed')
    return dest

browser=archive(f'kumo-{browser_version}-browser.zip',[(p,p.relative_to(root/'browser-extension')) for p in entries(root/'browser-extension') if 'tests' not in p.relative_to(root/'browser-extension').parts])
plugin_root=root/'plugins/kumo'
plugin_files=[p for p in entries(plugin_root) if 'src' not in p.relative_to(plugin_root).parts]
plugin=archive(f'kumo-{plugin_version}-plugin.zip',[(p,p.relative_to(plugin_root)) for p in plugin_files])
full=archive(f'kumo-{browser_version}-local-install.zip',[(p,Path('Kumo')/p.relative_to(root)) for p in entries(root)])
artifacts=[browser,plugin,full]
lines=[f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}' for p in artifacts]
(dist/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps([{'name':p.name,'bytes':p.stat().st_size} for p in artifacts],indent=2))
