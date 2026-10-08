"""Generate a standalone demonstration without overwriting the Pages entry."""
from pathlib import Path
import base64
import re

ROOT = Path(__file__).resolve().parent
logo = 'data:image/svg+xml;base64,' + base64.b64encode(
    (ROOT / 'assets' / 'cleartech-logo.svg').read_bytes()
).decode('ascii')
html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'src' / 'styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="./src/styles.css">', '<style>' + css + '</style>')
html = html.replace("window.CT_LOGO='./assets/cleartech-logo.svg';", 'window.CT_LOGO=' + repr(logo) + ';')
for name in ['core.js', 'xlsx.js', 'app.js']:
    source = (ROOT / 'src' / name).read_text(encoding='utf-8')
    if re.search(r'</script', source, re.I):
        raise ValueError('Unsafe script terminator in ' + name)
    html = html.replace('<script src="./src/' + name + '"></script>', '<script>' + source + '</script>')
out = ROOT / 'dist' / 'index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print('Standalone demonstration:', out, out.stat().st_size, 'bytes')
