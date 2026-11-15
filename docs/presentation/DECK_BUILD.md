# Construção do pitch ASTRA

Execute a partir da raiz do repositório:

```bash
python scripts/build-pitch.py --output-dir /caminho/para/apresentacao
```

Instale as dependências Python com `python -m pip install -r docs/presentation/requirements-export.txt` se necessário. A apresentação HTML será entregue também como arquivo único, com imagens embutidas. O vídeo MP4 é silencioso e serve como versão de reprodução cronometrada; a narração fica no roteiro e nas notas.

O script lê `PITCH_30_SLIDES.json` e usa Pillow, python-pptx e ReportLab. A fonte utilizada é DejaVu Sans, disponível em `/usr/share/fonts/truetype/dejavu/`. Os arquivos de arte em `docs/art/production-vision/`, quando presentes, são incorporados automaticamente; na ausência de imagens opcionais, o gerador usa um fundo gráfico. A captura de demonstração vem de `docs/demo/fixture-captures/fixture-04-canyon.png`.

A saída inclui PPTX editável com textos e formas nativos, notas de narração e avanço automático, PDF com texto nativo, PNGs 1920×1080, JPEGs 960×540, folha de contato, player HTML local, roteiro em Markdown e CSV e manifesto. O player funciona localmente, com início/pausa, setas e tela cheia. Os slides duram seis segundos cada, totalizando 180 segundos. Fontes e limites das evidências estão em `SOURCES.md`; as distinções entre demonstração e visão estão em `VISION_PRODUCTION.md`.
