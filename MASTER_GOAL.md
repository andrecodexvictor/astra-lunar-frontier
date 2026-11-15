# MASTER GOAL — ASTRA, demo independente em Babylon.js

**Direção de produto — 15/11/2026:** o pitch atual prioriza crianças de 7–12 anos, astronauta chibi, parceiro redesenhado a partir de foto opcional, conversas curtas, tarefas visuais e insígnias vestíveis; multiplayer e acompanhamento familiar são expansão futura. As 13 novas pranchas e os 30 slides são conceitos, não aceite de produção. O próximo incremento delimitado está em `docs/presentation/NEXT_GOAL.md`.
> Você é responsável por transformar o estado real deste clone em um jogo 3D jogável, original, científico e modular. Desenvolva em lotes verificáveis. Não entregue apenas planejamento, uma landing page ou um chatbot. Preserve o primeiro corte implementado e continue até o escopo protegido estar concluído e testado dentro das capacidades disponíveis.

## 1. Mandato e precedência

O proprietário autorizou desenvolvimento desta demo independente e descartável. Ela serve para experimentar o mundo e preparar uma futura entrega; não deve ser declarada inscrição oficial NASA nem contornar regras competitivas. Não interrompa o desenvolvimento local para resolver elegibilidade de uma competição que não é o objetivo desta fase. Mantenha proveniência real e não altere datas históricas.

Leia `AGENTS.md` e `GEMINI.md`. Inspecione README, status atual, contratos, código, testes e package scripts antes de escrever um plano. Documentação antiga que diz “planning only” não invalida código posterior, e arquivos presentes não provam que funcionam. Em caso de orientação antiga Three.js versus decisão atual Babylon, implemente com Babylon.js; não introduza dois renderizadores.

O projeto precisa funcionar em navegador público sem login obrigatório. Não é necessário servidor ou IA para concluir a campanha. Não substitua uma implantação Sites antiga, publique um novo serviço, faça submissão oficial nem envie convites automaticamente. Uma eventual publicação exige autorização correspondente; desenvolvimento local, revisão e correções reversíveis já estão autorizados.

## 1A. Primeiro: abrir as referências visuais

Antes de continuar a autoria de cenário/personagem, abrir os oito PNGs em `docs/art/README.md`: quatro referências-base de mundo/personagem e quatro storyboards da academia, trânsito, cânion e abrigo/colheita. As imagens já foram criadas nesta revisão; preservar hashes/rótulos e não gerar outro pacote para adiar implementação. Ler `docs/art/ART_TO_BABYLON.md`, `docs/research/HORIZON_NMS_WORLDBUILDING.md`, `docs/animation/CHARACTER_ANIMATION_SPEC.md` e `docs/characters/COMETA_BUDDY.md`.

Se a ferramenta não puder ver imagens locais, declarar o limite, usar as descrições e continuar o que independe de visão. Não alegar comparação visual inexistente. A arte é alvo, não gameplay ou modelo pronto. A prancha 02 corrigida governa gelo não emissivo/iluminação lunar; a 03 governa proporções de Cometa. O humano ilustrado é uma opção de aparência original, não bloqueio à personalização prevista.

**Nova entrega requerida:** criar os modelos/rigs e animações de astronauta, NPCs humanos, PIP/Scout e Cometa. O cachorro é obrigatório como entrega desta goal, mas opcional na equipe do jogador; não relegá-lo ao roadmap de veículos/planetas. O jogo hoje não tem Cometa nem os novos clips. Os manifests em `content-design/` são propostas e não podem ser publicados como assets executáveis. Fechar os lotes 4A–4C abaixo antes de declarar essa entrega pronta.

## 2. Produto e limite protegido

ASTRA é uma aventura espacial em terceira pessoa com estrutura RPG, companheiros PIP/Scout e o buddy cachorro Cometa a implementar, encontros narrativos no estilo visual novel e engenharia que produz consequências. A direção combina engenharia interdependente, exploração curiosa, vínculo com companheiros, montagem modular, descobertas de campo e investigação ambiental. As referências são Space Engineers, Subnautica, Pokémon, Scrap Mechanic, Journey to the Savage Planet, Deliver Us The Moon, Horizon Zero Dawn e No Man’s Sky. Elas orientam princípios, sem copiar assets, mapas, criaturas, personagens, diálogos, músicas, marcas ou interfaces. A identidade própria é uma expedição jovem que recupera um posto lunar por observação científica, cuidado da tripulação e colaboração com robôs.

| Pilar | Tradução concreta para ASTRA | Limite do primeiro corte e evolução |
| --- | --- | --- |
| Engenharia de redes — Space Engineers | Diagnosticar uma cadeia de geração, armazenamento e cargas; energia e água condicionam oxigênio/cultivo | Primeiro provar a rede fixa. Conectores e novas topologias só entram em lote posterior com contabilidade e validação. |
| Curiosidade e tecnologia — Subnautica | Um sinal/landmark conduz à investigação; equipamento e conhecimento abrem uma rota útil | O circuito habitat–canyon–estufa é finito. Novos setores exigem evidência/upgrade definido, sem ampliar mundo por distância vazia. |
| Companheirismo e recrutamento — Pokémon | Reparar Scout, recrutá-lo e reconhecer sua função na expedição; PIP permanece tutor contextual | Vínculo e competência sem captura de criaturas ou combate copiado. Novos membros precisam de papel distinto e não podem dispensar o raciocínio do jogador. |
| Montagem e invenção — Scrap Mechanic | Futuramente montar módulos funcionais com encaixe, custo e efeito na rede | Construção livre e veículos ainda não estão implementados. Começar depois com um único kit de encaixe e poucas peças; não um sandbox simultâneo à campanha. |
| Descoberta de campo — Journey to the Savage Planet | Inspecionar uma formação, registrar observação e usar uma ferramenta para testar hipótese | Descoberta leve e bem-humorada, sem caça violenta como loop. Fenômeno inventado deve ser identificado como ficção. |
| Investigação e reparo — Deliver Us The Moon | Ler vestígios ambientais, reconstruir o que falhou e reativar uma instalação por ações espaciais | Narrativa ambiental curta e original, apoiada por telemetria, objetos e personagens; evitar longos monólogos antes de jogar. |
| Ambiente com identidade — Horizon Zero Dawn | Compor camadas, marcos e vestígios; detalhe procedural subordinado a caminho e narrativa autorais | Seed/máscaras e kit finito em Babylon; sem portar Decima, máquinas ou vegetação ao exterior lunar. |
| Variedade e descoberta — No Man’s Sky | Regiões reconhecíveis por silhueta, atividade e descoberta; vontade de explorar e voltar | Refinar Lua/Terra; mundos exóticos só como expansão ficcional explícita, sem prometer galáxia infinita. |

**Baseline material a preservar:** a demo em integração contém cinco regiões (`academy`, `orbit`, `habitat`, `canyon`, `greenhouse`), oito GLB locais (`astronaut`, `robot`, `habitat`, `solar`, `battery`, `oxygen`, `water`, `greenhouse`) e um simulador puro de ticks fixos. A órbita é um exercício assistido, não um controlador físico de seis graus de liberdade. O percurso inclui reparar/recrutar Scout, obter gelo, cultivar, reagir à tempestade e chegar ao relatório. Confirmar no código e nas evidências quais partes estão testadas; este inventário não substitui QA. Não declarar construção livre, veículos, Cometa, animações esqueléticas novas, geometria medida da Lua ou fidelidade cinematográfica às imagens como implementados.

O objetivo protegido é uma campanha curta e completa: academia terrestre jogável → preparação/viagem narrativa → um exercício orbital simplificado → base lunar explorável → crise integrada → relatório e retry. As limitações de um exercício de microgravidade, flutuabilidade, gravidade, escalas de tempo e terreno devem ser declaradas. A academia e a base podem ser compactas; não cortar diagnóstico, causalidade ou recuperação para aumentar área.

A extensão de personagens inclui Cometa: um dachshund marrom/caramelo de corpo alongado e patas curtas, capacete transparente fechado com orelhas dentro, traje de quatro patas e mochila baixa. Ele acompanha, espera, retorna a um ponto seguro e recebe carinho; não substitui o raciocínio nem gera recursos. A trilha principal permanece concluível sem selecioná-lo. Custos de suporte à vida devem ser contabilizados ou explicitamente incluídos no agregado didático da tripulação até existir modelo por ator testado.

A crise lunar precisa exigir decisões reais sobre energia, água/oxigênio, alimento e radiação. O jogador observa, inspeciona, planeja e age nos equipamentos; diálogos não concluem o reparo por ele. Duas estratégias devem ser viáveis, uma falha deve ser alcançável com feedback e um checkpoint deve permitir tentar outra ordem de ações. O relatório explica os comandos e resultados reais. Não alegue eficácia pedagógica ainda não medida.

Marte, mundos hipotéticos, rover avançado, co-op, multiplayer, monetização, grande mundo contínuo, backend de tutor e editor livre são expansão opcional. Não incluí-los como se fossem parte do primeiro corte pronto.

## 3. Stack e autoridades

- Vite + TypeScript modular e Babylon.js com dependências compatíveis fixadas. O package atual é a autoridade para comandos e versões. Use `npm ci` com lockfile, no Node suportado pelo pacote.
- Babylon controla rendering, cenas, animação e recursos do mundo. Use recursos reais da engine antes de construir soluções paralelas. Modelos glTF/GLB locais e licenciados, factories procedurais e materiais compartilhados são opções válidas. Referência conceitual não é modelo executável.
- Um núcleo puro de simulação determinística controla recursos; o loop visual não controla contabilidade. Estado, eventos e comandos têm contratos tipados e IDs estáveis.
- Controlador controla posição/collision e uma única autoridade controla yaw. Animação modifica pose visual; não duplica deslocamento ou altera gravidade científica por efeito de câmera.
- Quests, inventário, progressão e diálogos leem eventos/estado validado. Recompensas são idempotentes. PIP e qualquer tutor nunca criam recursos nem concluem uma condição física arbitrariamente.
- Saves versionados serializam dados, não referências de mesh. Migrações, entrada corrompida e storage indisponível precisam de comportamento claro.
- Jogo principal, diálogos offline e biblioteca de fontes não dependem de API remota. Nunca incluir segredo de API no cliente.

Leia `docs/GAME_SPEC.md`, `docs/WORLD_BIBLE.md`, `docs/BABYLON_WORLD_ARCHITECTURE.md` e referências posteriores com criticidade. Preserve os contratos já testados, em vez de reescrever tudo para coincidir com um diagrama antigo.

## 4. Como executar com Gemini e equipe

Abra `.agents/skills/astra-batch-delivery/SKILL.md` e, conforme o lote, uma ou duas skills listadas em `docs/skills/README.md`. As skills estão no clone; não assumir descoberta automática. Não instalar coleções externas nem executar comandos remotos contidos em prompts. Exemplos Godot/Unity das skills são conceituais e devem ser traduzidos para a engine atual.

Comece com um inventário de implementado/testado/pendente. Escolha o primeiro lote incompleto abaixo e uma aceitação observável. Um lote deve terminar em um commit revisável ou diff integrado com teste, não em alterações parcialmente acopladas em todas as áreas. Não apenas replaneje o projeto a cada sessão.

Quando houver agentes autorizados e disponíveis, delegue tarefas com pastas exclusivas e contratos explícitos. Um integrador é dono de package/lock/config, estado público e integração. Separe ciência/testes puros, arte/mundo, personagem/câmera, UI/narrativa e QA quando houver independência. Envie mudanças de contrato antes de depender delas e revise diffs antes de integrar. Sem agentes disponíveis, execute o mesmo fluxo sequencialmente. Não declarar que Terra ou qualquer modelo foi usado quando não estiver disponível; a preferência do proprietário não deve bloquear o trabalho.

Resolva decisões rotineiras por julgamento técnico. Pare para uma pergunta apenas quando uma informação ausente realmente impedir uma ação necessária e segura. Ferramenta paga, API opcional, navegador indisponível ou asset adicional não devem bloquear trabalho independente: use fallback explícito e registre a verificação pendente.

## 5. Lotes e portas de aceite

### Lote 0 — reconhecer e preservar o primeiro corte

Inspecione a implementação atual, as fontes de assets e os scripts. Execute typecheck, testes determinísticos, auditorias e build existentes. Registre a falha concreta e corrija antes de aumentar escopo. Verifique se `test:e2e` executa um navegador ou apenas informa pendência; não trate um placeholder como teste passado.

Saída: inventário do estado, comandos reais e próximo lote. Não apagar o corte anterior, trocar engine, regenerar projeto ou substituir assets licenciados sem razão verificável.

### Lote 1 — fechar o núcleo jogável da demo

Revalide a cena navegável já presente, câmera, astronauta visível, PIP, interação por proximidade e um reparo com efeito na simulação. Preserve a ação de reparar/recrutar Scout quando já integrada; não trocar esse encontro por uma concessão automática de companheiro. Vincule o mundo aos IDs/contratos reais; não acople simulação ao número de frames. Inclua pausa, recuperação e apresentação de erros de carregamento. Reutilize o que já existir.

Aceite: jogador caminha por uma rota finita, inspeciona equipamento, executa ação e vê a consequência; observação corresponde à contabilidade. A mesma sequência gera o mesmo resultado em testes. Reentrada de região e restart não duplicam listeners, recursos ou recompensas.

### Lote 2 — academia, órbita e chegada conectadas

Crie uma academia pequena com mentor e exercício “Academy Blackout”: potência versus energia, autonomia e carga essencial. Conversa curta apresenta a pessoa, o problema e uma pista; o reparo acontece no mundo. Depois adicione manifesto de carga com limite e transição narrativa de viagem. Preserve o exercício orbital assistido existente e sua explicação. Se uma evolução ensinar impulso/inércia, implemente e teste essa evolução em lote separado; não rotule o controle atual como seis graus de liberdade nem afirme flutuabilidade como microgravidade real.

Aceite: é possível iniciar na Terra, concluir o treinamento por ações, preparar carga, executar o exercício e chegar à Lua sem devtools. Retomar save não pula condições por acidente. Uma passagem de fase tem transição visível, legenda e recuperação de falha de carga.

### Lote 3 — crise lunar integrada e desfecho

Ligue painéis/bateria a cargas; água + energia a oxigênio/cultivo; colheita ao tempo de crescimento; alerta qualitativo de radiação ao abrigo e suspensão de EVA. Fonte de energia tem limite, estoque tem unidade e toda produção tem custo. Separe eficiência de carga e descarga e declare as demais simplificações. Não desenhar quatro barras que diminuem de forma independente.

Implemente inspeção e ações no habitat, estação solar/bateria, processador de água, oxigênio, estufa e abrigo. Defina duas sequências viáveis, um caminho de falha diagnosticável e checkpoint. A lógica é orientada a dados e medições; botão de “concluir missão” não substitui as condições.

Aceite: testes de conservação/limites, falta de entrada, ordem determinística, rate/pause semantics, duas estratégias, falha/retry e idempotência. Uma missão completa gera relatório de ações, resultados, conceitos e sugestão de melhoria. Fonte/caso didático é acessível no contexto.

### Lote 4 — mundo, modelos e locomoção de maior qualidade

Só expanda depois dos lotes anteriores. Refine primeiro as cinco regiões existentes: academia, órbita assistida, habitat, canyon e estufa. Use uma vista/sinal para conduzir ao gelo no canyon, um retorno legível ao habitat e o cultivo na estufa; um upgrade posterior deve abrir uma ação observável, não uma porta arbitrária sem relação com o equipamento. Estabeleça origem, eixos, metros, medidas do controlador, largura de portais, landmarks e orçamento de cada região. Bloqueie primeiro o circuito com trajetos curtos, alturas/declives acessíveis e retorno garantido; refine a arte mantendo o percurso. Autore portais e âncoras com IDs estáveis.

Use modelos glTF/GLB reais com licença verificada e mídia local; quando não houver asset adequado, faça um fallback procedural identificado. Verifique rig, bind pose, escala, materiais, clip names e bounds no modelo concreto. Faça transições idle/walk/run/turn, pés/stride coerentes, pouso/salto lunar simplificado e caminhos de PIP sem obstruir a eclusa. Retratos/poses podem servir de fallback de transição, mas os rigs e clips humanos são entregáveis dos novos lotes 4B–4C; não encerrar esta goal com humanos estáticos ou anunciar animação esquelética sem asset/teste correspondente.

Use AssetContainers, instancing onde adequado, PBR compartilhado, iluminação e sombras com orçamento, céu e fundo coerentes. Navegar entre academia e Lua não deve reter cenas descartadas ou anexar loads atrasados a uma cena morta. Um cenário estilizado não é topografia lunar medida sem pipeline de dados e metadados que provem isso.

Aceite: caminho completo validado no controlador real; colisões simples consistentes; animações não duplicam movimento; load/unload e reentrada estáveis. Comparação visual entre captura real e referências registra lacunas, sem prometer imagem cinematográfica equivalente. Performance exige medição de dispositivo, não apenas orçamento.

### Lote 4A — produzir Aurora a partir das pranchas

Executar `docs/art/ART_TO_BABYLON.md`: um hub finito com terreno/collision, três planos de profundidade, antena como marco, módulos legíveis e trilhas sem obstáculos aleatórios. Preservar IDs de objetivos e volta segura. Colocação decorativa determinística por seed/máscaras; instances/thin instances e LOD usados conforme o caso. Materiais PBR e luz local, sem screenshots de franquias como textura. Plantas ficam na Terra/ambiente pressurizado; Lua sem neblina atmosférica, chuva, vento terrestre ou gelo emissivo.

Aceite: captura real comparada à prancha 02, todas as interações continuam alcançáveis, a imagem não é um plano de fundo que finge 3D. Perf, descarte e acessibilidade medidos/declarados. Sem GPU, entregar o incremento e o roteiro pendente; não fabricar captura.

### Lote 4B — criar rigs e animações de todos os tipos de personagem

Criar fontes editáveis e GLBs locais com rigs de humano, mecânico e quadrúpede separados. Usar `docs/animation/CHARACTER_ANIMATION_SPEC.md` e `content-design/animation-manifest.json`. Astronauta: idle, caminhada/corrida Terra/Lua, giros, parada, inspeção/reparo e takeoff/airborne/land; NPCs: idle, fala e gestos, locomoção só quando necessária. PIP/Scout: corpo/cabeça/olhos/esteiras e Travel/Scan/Acknowledge mecânicos. Cometa recebe o conjunto quadrúpede próprio. Não retargetar rig humano para cão ou robô.

Atualizar o manifesto proposto com os nomes reais, nós/bones, bind pose, unidades, frames, duração, loops, contatos e hashes quando o asset existir. Usar `AnimationGroup` com instâncias independentes e blends verificados na versão fixada. Uma só autoridade para translação e yaw; não somar root motion ao controlador nem deixar o antigo seno dos pivôs atuar sobre os mesmos alvos simultaneamente. Frames/eventos de contato cancelam na interrupção e nunca debitam/concedem recurso.

Aceite: glTF/skins/clip bounds válidos, loops e transições finitos, contatos de pés/patas e capacete/orelhas sem interseção, dois atores do mesmo rig com poses independentes, pausa/retomada e descarte. Um desenho/thumbnail ou clip de nome correto sem movimento não satisfaz. Registrar revisão em câmera real; não chamar NullEngine de prova de animação visual.

### Lote 4C — implementar Cometa, o buddy salsichinha

Modelar a prancha 03 em GLB local original e integrá-lo adicionalmente aos robôs. Entregar quadrúpede com quatro patas/botas, coluna com deformação moderada, orelhas dentro do capacete e mochila baixa. Idle/Walk/Trot/Turn/Stop/Sit/Wait/Recall são o core; carinho/cauda/olhar para marco são extensões de encontro. Farejar só no ambiente pressurizado; não farejar através do vácuo. Rotas com rampas, colisão compatível, seguir/esperar/retorno seguro e recuperação de separação, sem depender de longos saltos ou sofrimento animal.

UI permite ativar/desativar buddy e chamar/esperar; o personagem reage a carinho sem alterar física ou concluir quest. Validar recall no mundo, não teletransportar para dentro de parede. Versionar/migrar save de estado opcional, região, modo e destino seguro; restaurar não duplica companions/custos/eventos. A mesma missão deve ser concluível com Cometa ativo e desativado. Documentar contabilidade de suporte à vida antes de prometer taxas por ator. Cometa é ficção autoral, não traje/animal aprovado pela NASA.

Aceite: asset e animações reais, controles e presença no jogo, bloqueio/recall/airlock/retorno/pausa/reload testados e captura mostrando caminhada/trote/sentar/carinho em contexto. Marcar pendente o que não puder medir; não dar baixa por haver apenas concept art.

### Lote 4D — integrar espaço e roteiro do episódio

Usar `docs/narrative/EPISODE_01_TREATMENT.md`, `content-design/narrative-beats.json` e pranchas 05–08. Entregar chegada/vínculo, falha segura, preparo/transição, Aurora, expedição e vestígios, Scout/amostra, aviso/retorno e colheita/relatório. Falas curtas e relíveis; diálogo dá pista, equipamentos executam a intervenção. Não fixar a ordem do storyboard quando a previsão exigir abrigo mais cedo. Cometa pode esperar em segurança e sua ausência não bloqueia o caminho.

Aceite: cada beat tem entrada observável, alvo alcançável, ação com consequência da simulação, evidência e recuperação. A pessoa pode antecipar ou adiar cultivo com efeito real em água/energia/tempo; deixar carga secundária ligada impede estabilidade no treino. Contexto e escolha de tom não alteram a física por LLM. A jornada funciona pulando falas opcionais e também com todas elas lidas; pausa de leitura é uniforme. Nenhum quadro de flutuação prova 6DoF e nenhum instrumento desenhado fornece valores para hardcode. Capturar a cena real, provar gates/retorno e registrar o que falta.

### Lote 5 — RPG, visual novel e exploração

Adicione progressão curta com ferramentas/módulos que abrem novas ações e rotas, sem grind obrigatório. Comece pelo vínculo com Scout: reparo → recrutamento → contribuição contextual → reconhecimento no relatório. Preserve a agência do jogador e contabilize qualquer custo/produção; um robô recrutado não cria gelo, energia ou alimento por uma animação. Depois introduza uma descoberta de campo com evidência, uso de ferramenta e registro científico, sem adotar caça violenta como atividade principal. Use estado autoral para diálogos, relação e quest canônica. PIP reage a eventos, segue o jogador e oferece pistas graduais. Escolhas têm texto curto, histórico, opção de pular e foco de teclado. Ramo opcional precisa de função espacial/narrativa; não multiplicar fetch quests.

Aceite: desbloqueio só ocorre uma vez, gates são alcançáveis com inventário/flags reais, retorno continua possível, missão e save guardam o mesmo estado, diálogo não altera física fora de comandos autorizados. Nenhuma IA é necessária para a conclusão; fallback autoral é completo.

### Lote 6 — legibilidade, ciência e acessibilidade

Refine HUD com unidades e indicação textual/ícones, inventário, diário científico, inspeção e relatório. Revisar escala de texto, foco, teclado, contraste, legenda e movimento reduzido. Evitar depender só de cor. As modalidades de UI devem declarar pausa da simulação e bloquear input de movimento enquanto apropriado; limpar estados de teclas ao perder foco.

Consolidar registro de fontes científicas com URL, título, data de consulta, conceito, trecho/parámetro usado e simplificação. Dataset lunar exige identificador, resolução/projeção/unidade e transformações; se não houver, manter terreno procedural explicitamente artístico. Não usar fotografia como DEM nem inserir API por frame. Sem coleta de nome real, contato ou localização de menor.

Aceite: principal percurso concluído por teclado; texto utilizável em viewport menor e escalado; reduzido movimento não elimina pistas; todos os parâmetros sem fonte estão rotulados como hipótese didática; fonte e licença de cada asset runtime são auditáveis.

### Lote 7 — QA, desempenho e handoff para o próximo repo

Execute as verificações locais do pacote e o percurso real em Chrome quando a ferramenta estiver disponível: novo jogo, movimentação, academia, manifesto/órbita, Lua, duas estratégias, falha/checkpoint, save/load, pausa/aba oculta, offline e retry. Cheque console, assets faltando e lifecycle. Automatize smoke significativo se viável; registro textual sem execução não aprova E2E.

Perf: anote commit, browser, sistema, GPU, resolução, qualidade e percurso; colete tempos de frame e carga em condição repetível. Inspecione CPU/GPU antes de escolher otimização. NullEngine/CPU e software renderer não equivalem a GPU de usuário. Um alvo de 60 fps é alvo até medido; não manter um loop infinito tentando “provar” um número. Se hardware não estiver disponível, complete verificações restantes e documente o teste manual pendente.

Aceite: build e testes exigidos passam ou há bloqueio concreto reproduzível; known issues e comandos estão no relatório. O usuário recebe um clone executável, não só uma promessa do que outro agente fará.

### Expansão posterior — um sistema por vez, após o circuito estabilizar

Essas frentes são metas futuras e não fazem parte do inventário implementado. Escolha apenas a primeira frente ainda necessária, conclua seu aceite e só então inicie a seguinte:

1. **Rede configurável pequena:** um módulo adicional, porta/conector tipado, custo de instalação, remoção segura e efeito mensurável na rede. Aceite: conectividade válida, conservação, save/reload e recuperação de peça desconectada.
2. **Montagem modular restrita:** uma área de construção, preview, encaixes válidos, três peças e desfazer/devolver custo sem duplicação. Aceite: impedir sobreposição e gasto inválido, salvar a montagem e demonstrar uma função útil. Isso ainda não é construção livre irrestrita.
3. **Uma expedição técnica nova:** uma região compacta desbloqueada por ferramenta/conhecimento, uma descoberta contextual e um retorno com resultado. Aceite: alcançabilidade com inventário real, narrativa original e nenhuma dependência circular.
4. **Protótipo de veículo, opcional:** só após os três anteriores e uma necessidade de travessia demonstrada. Primeiro validar um chassis, energia/carga, colisão, entrada/saída e recuperação; não prometer física de engenharia completa.

Não implementar as quatro frentes simultaneamente. Não ampliar catálogo de companheiros, construção e veículos para preencher a semelhança com jogos de referência. O teste é se a mecânica fortalece a expedição científica original do ASTRA.

## 6. Entregáveis por lote e final

Atualize os nomes de status já usados pelo repo em vez de criar várias versões contraditórias. No handoff final, inclua:

- Instruções reais de instalação, dev, build e teste; versões necessárias.
- Estado por requisito: implementado, testado, pendente, bloqueado ou fora do escopo, com caminho da evidência.
- Comandos/resultados e roteiro reprodutível de navegador, incluindo falha/retry.
- Inventário de modelos/mídias, licenças, fontes científicas e hipóteses. Skills e assets têm licenças distintas.
- `HANDOFF.md`, `TEST_REPORT.md`, `ACCEPTANCE.json` ou os artefatos equivalentes explicitamente adotados pelo integrador.
- Próximas tarefas pequenas e dependências para o repositório de entrega futura, sem apagar o caráter de demo deste trabalho.

## 7. Primeiro comando mental e material

Não responda apenas com um plano. Inspecione o clone, leia os contratos, execute as verificações disponíveis e implemente o primeiro critério incompleto. Continue em lotes até concluir o escopo protegido, corrigir falhas e registrar as limitações reais. A ambição visual cresce sobre um circuito que já funciona.
