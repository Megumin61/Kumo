from pathlib import Path
import hashlib, json, zipfile

root=Path(__file__).resolve().parents[1]
dist=root/'dist'
dist.mkdir(exist_ok=True)
ignored={'.git','node_modules','dist','__pycache__'}
forbidden={'local-config.json','bridge-config.json','.env'}
def entries(folder):
    return sorted(p for p in folder.rglob('*') if p.is_file() and not any(x in ignored for x in p.relative_to(root).parts) and p.name not in forbidden)
def archive(name, pairs):
    dest=dist/name
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for source,rel in pairs:
            z.write(source,str(rel).replace('\\','/'))
    with zipfile.ZipFile(dest) as z:
        if z.testzip(): raise RuntimeError('Archive verification failed')
    return dest

browser=archive('kumo-0.18.0-browser.zip',[(p,p.relative_to(root/'browser-extension')) for p in entries(root/'browser-extension')])
plugin_root=root/'plugins/kumo'
plugin_files=[p for p in entries(plugin_root) if 'src' not in p.relative_to(plugin_root).parts]
plugin=archive('kumo-0.13.4-plugin.zip',[(p,p.relative_to(plugin_root)) for p in plugin_files])
full=archive('kumo-0.18.0-local-install.zip',[(p,Path('Kumo')/p.relative_to(root)) for p in entries(root)])
artifacts=[browser,plugin,full]
lines=[f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}' for p in artifacts]
(dist/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps([{'name':p.name,'bytes':p.stat().st_size} for p in artifacts],indent=2))
