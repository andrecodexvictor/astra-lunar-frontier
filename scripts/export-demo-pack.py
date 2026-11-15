#!/usr/bin/env python3
"""Export existing ASTRA artwork and the current built demo; never builds the game."""
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://astra-mission-trainer.andrevictorandrade.chatgpt.site'

LAUNCHER = '''#!/usr/bin/env python3
import functools
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

class Server(socketserver.TCPServer):
    allow_reuse_address = True

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parent / "dist"))
# Port 0 asks the operating system for an available local port.
with Server(("127.0.0.1", 0), handler) as server:
    url = "http://127.0.0.1:%d/" % server.server_address[1]
    print("ASTRA: " + url, flush=True)
    print("Mantenha esta janela aberta; Ctrl+C encerra.", flush=True)
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
'''

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, type=Path, help='Diretório raiz de entrega')
    args = parser.parse_args()
    out = args.output_dir.resolve()
    if out == ROOT or out in ROOT.parents or ROOT in out.parents:
        parser.error('Use um diretório de saída fora do projeto.')
    if not (ROOT / 'dist/index.html').is_file():
        parser.error('dist/index.html ausente; gere o build antes de exportar.')
    for name in ('02-artes', '03-demo-jogavel'):
        dest = out / name
        if dest.is_symlink():
            parser.error(f'Destino não pode ser link simbólico: {dest}')
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
    art, demo = out / '02-artes', out / '03-demo-jogavel'
    records = {}
    def copy(src, dst, role, classification):
        src = ROOT / src
        if not src.is_file() or src.is_symlink():
            raise RuntimeError(f'Arquivo ausente ou link simbólico: {src}')
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        records[dst] = (role, str(src.relative_to(ROOT)), classification)
    def write(dst, data, role, classification='documentação do pacote'):
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(data, encoding='utf-8')
        records[dst] = (role, 'gerado por scripts/export-demo-pack.py', classification)
    for sub, target, cls in [('docs/art', '01-conceitos-originais', 'conceito gerado por IA; não é captura de jogo'), ('docs/art/production-vision', '02-visao-futura', 'conceito futuro gerado por IA; não é funcionalidade demonstrada'), ('docs/demo/captures', '03-capturas-historicas', 'captura real histórica de navegador'), ('docs/demo/fixture-captures', '04-capturas-preparadas', 'captura real de navegador com estado e câmera preparados; não prova percurso completo')]:
        for p in sorted((ROOT / sub).glob('*.png')):
            copy(p.relative_to(ROOT), art / target / p.name, 'referência visual', cls)
    for rel in ['docs/art/README.md', 'docs/art/ART_TO_BABYLON.md', 'docs/art/manifest.json', 'docs/art/production-vision/ART_NOTES.json', 'docs/art/production-vision/manifest.json', 'docs/art/production-vision/README.md', 'docs/presentation/SOURCES.md', 'docs/presentation/VISION_PRODUCTION.md', 'docs/presentation/NEXT_GOAL.md', 'docs/demo/VISUAL_REVIEW.md', 'docs/demo/VISUAL_FIXTURE_REPORT.json', 'docs/demo/BROWSER_SMOKE.md', 'public/assets/manifest.json', 'public/science/earth-provenance.json', 'NOTICE', 'LICENSE', 'public/assets/Babylon-LICENSE.txt']:
        copy(rel, art / 'creditos-e-contexto' / rel, 'créditos e contexto', 'fonte do projeto')
    for p in sorted((ROOT / 'public/assets/models').rglob('*.glb')):
        copy(p.relative_to(ROOT), art / '05-modelos-e-textura' / p.relative_to(ROOT / 'public'), 'modelo 3D real', 'asset do jogo')
    copy('public/assets/textures/earth.jpg', art / '05-modelos-e-textura/assets/textures/earth.jpg', 'textura da Terra', 'NASA; consultar proveniência')
    # Bundle the actual renderer locally, then execute it without downloading packages.
    with tempfile.TemporaryDirectory() as tmp:
        bundle = Path(tmp) / 'portraits.cjs'
        esbuild = ROOT / 'node_modules/.bin/esbuild'
        if not esbuild.exists():
            raise RuntimeError('esbuild local ausente; instale as dependências do projeto antes de exportar retratos.')
        subprocess.run([str(esbuild), str(ROOT / 'src/presentation/portraits.ts'), '--bundle', '--platform=node', '--format=cjs', '--outfile=' + str(bundle)], check=True, capture_output=True)
        runner = "const p=require(process.argv[1]); for(const id of p.PORTRAIT_IDS) console.log(JSON.stringify([id,p.renderPortraitSvg(id,{size:'lg'})]));"
        result = subprocess.run(['node', '-e', runner, str(bundle)], check=True, capture_output=True, text=True)
        for line in result.stdout.splitlines():
            ident, svg = json.loads(line)
            write(art / '06-retratos-svg' / (ident + '.svg'), svg + '\n', 'retrato SVG renderizado pelo código real', 'asset do jogo; cadete com aparência padrão')
    try:
        from PIL import Image, ImageDraw
        images = sorted((art / '01-conceitos-originais').glob('*.png')) + sorted((art / '02-visao-futura').glob('*.png'))
        canvas = Image.new('RGB', (1200, ((len(images) + 2) // 3) * 260), 'white')
        draw = ImageDraw.Draw(canvas)
        for i, p in enumerate(images):
            with Image.open(p) as im:
                im.thumbnail((380, 220))
                x, y = (i % 3) * 400, (i // 3) * 260
                canvas.paste(im, (x + (400 - im.width) // 2, y))
                draw.text((x + 8, y + 225), ('FUTURO: ' if p.parent.name == '02-visao-futura' else 'CONCEITO: ') + p.name, fill='black')
        sheet = art / 'indice-visual.jpg'
        canvas.save(sheet, quality=88)
        records[sheet] = ('índice visual', 'miniaturas dos conceitos exportados', 'índice gerado; originais preservados')
    except ImportError:
        print('Pillow indisponível: índice visual não gerado.')
    from reportlab.pdfgen import canvas as pdf_canvas
    from PIL import Image
    concept_book=art/'ASTRA-13-pranchas-producao.pdf'
    pdf=pdf_canvas.Canvas(str(concept_book),pagesize=(1672,941))
    pdf.setTitle('ASTRA — visão de produção: 13 pranchas conceituais')
    with tempfile.TemporaryDirectory() as previews:
        for page in sorted((art/'02-visao-futura').glob('*.png')):
            jpeg=Path(previews)/(page.stem+'.jpg')
            with Image.open(page) as original: original.convert('RGB').save(jpeg,quality=94,optimize=True)
            pdf.drawImage(str(jpeg),0,0,width=1672,height=941,preserveAspectRatio=True,anchor='c')
            pdf.showPage()
    pdf.save()
    records[concept_book]=('caderno de conceitos de produção','13 novas pranchas geradas por IA','conceito futuro; não são capturas do jogo')
    for p in sorted((ROOT / 'dist').rglob('*')):
        if p.is_file():
            copy(p.relative_to(ROOT), demo / p.relative_to(ROOT), 'build estático jogável', 'demo atual compilada')
    write(demo / 'iniciar.py', LAUNCHER, 'servidor local')
    write(demo / 'Iniciar.sh', '#!/bin/sh\ncd "$(dirname "$0")"\nif command -v python3 >/dev/null 2>&1; then exec python3 iniciar.py; else echo "Instale Python 3 e tente novamente."; exit 1; fi\n', 'atalho Linux/macOS')
    (demo / 'Iniciar.sh').chmod(0o755)
    write(demo / 'Iniciar.bat', '@echo off\r\ncd /d "%~dp0"\r\nwhere py >nul 2>nul\r\nif not errorlevel 1 (py -3 iniciar.py & goto :end)\r\nwhere python >nul 2>nul\r\nif not errorlevel 1 (python iniciar.py & goto :end)\r\necho Instale Python 3 e tente novamente.\r\npause\r\n:end\r\n', 'atalho Windows')
    write(demo / 'LEIA-ME.txt', f'''ASTRA — DEMO JOGÁVEL\n\nOnline: {SITE}\nA versão online não exige login para jogar.\n\nPara jogar esta cópia local: descompacte toda a pasta; instale Python 3 se necessário; execute Iniciar.bat no Windows, Iniciar.sh no Linux/macOS ou python3 iniciar.py. O servidor usa apenas 127.0.0.1 e escolhe uma porta livre. O navegador abre automaticamente; se não abrir, copie o endereço mostrado. Mantenha a janela aberta e pressione Ctrl+C para encerrar. Não é necessário npm para executar este build. Abrir dist/index.html por file:// não funciona corretamente.\n\nUse navegador com WebGL 2. WASD ou setas movem; arraste o mouse para a câmera; Shift corre, Espaço salta e E interage. Tab abre objetivos, J diário, M mapa e Esc pausa. Há controles de toque na tela. O salvamento fica no navegador.\n\nEsta é uma demo independente, não uma submissão oficial nem produto endossado pela NASA. Modelos ASTRA e licenças estão em dist/assets; proveniência da textura da Terra em dist/science. Consulte o pacote de artes para créditos completos. As capturas preparadas não provam um percurso completo. Revisão em GPU física, dispositivos e teste completo de ponta a ponta permanecem limitados/pendentes; desempenho e aparência variam. Voz, geração de avatar por foto, insígnias vestíveis, multiplayer e aplicativo de pais são conceitos futuros, não funções implementadas.\n''', 'guia de execução')
    write(art / 'LEIA-ME.txt', '''ASTRA — ARTES E REFERÊNCIAS\n\n01: oito conceitos originais gerados por IA; 02: treze imagens de visão futura geradas por IA, não funcionalidades atuais. 03: capturas históricas reais; 04: capturas reais com estados e câmeras preparados, não prova de percurso completo. 05: 13 modelos GLB reais e textura da Terra. 06: sete SVGs produzidos pela função real do jogo; o cadete usa aparência padrão. O índice visual é apenas uma folha de contato; os PNGs originais estão preservados. Consulte creditos-e-contexto para proveniência, licenças e limitações. Voz, geração de avatar por foto, insígnias vestíveis, multiplayer e aplicativo de pais são conceitos futuros.\n''', 'guia de artes')
    for folder in (art, demo):
        entries = []
        for p in sorted(folder.rglob('*')):
            if p.is_file():
                role, origin, classification = records[p]
                entries.append({'file': p.relative_to(folder).as_posix(), 'sha256': sha(p), 'role': role, 'origin': origin, 'classification': classification})
        (folder / 'MANIFESTO.json').write_text(json.dumps({'algorithm': 'SHA-256', 'note': 'O manifesto não inclui seu próprio hash.', 'files': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for folder, name in [(art, 'ASTRA-artes-2026-11-15.zip'), (demo, 'ASTRA-demo-jogavel-2026-11-15.zip')]:
        with zipfile.ZipFile(out.parent / name, 'w', zipfile.ZIP_DEFLATED) as z:
            for p in sorted(folder.rglob('*')):
                if p.is_file():
                    z.write(p, p.relative_to(out))
    print('Exportado:', art, demo)

if __name__ == '__main__':
    main()
