# Exportar artes e demo

Após gerar e verificar o build final e atualizar as capturas, execute na raiz do projeto:

```sh
python3 scripts/export-demo-pack.py --output-dir /workspace/artifacts/ASTRA-Export-2026-11-15
```

O exportador substitui somente `02-artes` e `03-demo-jogavel` dentro da raiz indicada, e gera os ZIPs correspondentes no diretório pai. Não modifica a apresentação. Requer Python 3, Node e esbuild já instalado localmente para renderizar os sete SVGs diretamente do código; Pillow é opcional para a folha de contato. Não baixa dependências e não gera o build: copia o `dist/` existente. Verifique os manifestos SHA-256 e os relatórios de evidência antes da entrega. Os manifestos não incluem seu próprio hash.

Os PNGs são copiados sem alteração, separados entre conceitos, visão futura, capturas históricas e capturas de estados preparados. Os GLBs, textura, licenças e proveniência são copiados dos arquivos reais. O jogo compilado é servido localmente por Python em 127.0.0.1, numa porta livre; a pessoa que joga não precisa de npm. Abrir por `file://` não é suportado. A versão online indicada no pacote pode ter revisão diferente do build local: confira `docs/PUBLICATIONS.json`.
