# Pokétrilha — Ecos do Bosque

Uma pequena aventura Pokémon de exploração, em português, com visual **inspirado no HD-2D**: personagens e árvores em pixel art original, cenário 3D, câmera ortográfica inclinada, sombras, luz de fim de tarde, água animada, partículas e pós-processamento de foco, brilho e vinheta.

## Jogar no navegador

**[Abrir o jogo no GitHub Pages](https://zenidavi.github.io/codex-playground/)**

O site é estático. O GitHub Pages deve publicar a branch `main`, pasta `/ (root)`. O arquivo `.nojekyll` dispensa o processamento Jekyll. Depois de uma atualização, aguarde a publicação e use **Ctrl+F5** se o navegador ainda mostrar a versão anterior.

Para rodar localmente, instale **Node.js 20+**, abra o terminal na pasta do projeto e execute:

```sh
npm start
```

No Windows/PowerShell também pode usar `npm.cmd start`. Abra `http://localhost:3000` no mesmo computador. Não precisa de `npm install` para jogar: o servidor usa apenas Node, e os módulos Three.js já estão incluídos em `assets/vendor/`.

Alternativa: `python3 -m http.server 3000`. Use HTTP, pois abrir o HTML por dois cliques (`file://`) pode bloquear os módulos JavaScript.

Requer navegador moderno com **WebGL 2** e aceleração gráfica. Se o contexto gráfico não iniciar, o jogo mostra orientações. Não depende de API, CDN, conta, credencial, banco de dados ou fonte externa.

## A aventura

- Escolha **Bulbasaur, Charmander ou Squirtle** no laboratório da professora Lia.
- Caminhe por **Vila Primavera** e pelo **Bosque de Aurora**, com seu parceiro seguindo você. Há casas, floresta, um lago e uma ponte para descobrir.
- Converse com **Lia**, a enfermeira **Clara** e o treinador **Theo**. Leia a placa da rota para se orientar.
- Os encontros surgem **ao caminhar na grama alta**; as trilhas são seguras. Batalhas têm tela própria, golpes, efeitos, HP, experiência e níveis.
- Enfraqueça o adversário e use **Poké Bolas**. A coleção na mochila registra as quatro espécies selvagens: Caterpie, Pidgey, Oddish e Pikachu.
- Vença **3 encontros**, capture **pelo menos um Pokémon** e volte à Lia para receber a **Insígnia do Bosque**. É possível continuar explorando depois.
- No Centro Pokémon, Clara recupera todo o HP e repõe **3 poções e 5 Poké Bolas**, gratuitamente. Em uma derrota, o botão de retorno também leva você ao Centro.

Esta é uma miniaventura, com um mapa, uma missão e nível máximo 20. Capturas ficam na coleção; o inicial continua sendo o parceiro das batalhas. Não há evolução, troca de parceiro, ginásios ou multiplayer.

## Controles

| Ação | Teclado | Celular |
| --- | --- | --- |
| Caminhar | WASD ou setas | Direcional na tela |
| Conversar / ler placa | E ou Enter, perto da pessoa/placa | Botão A ou aviso de interação |
| Avançar conversa | E, Enter ou Espaço | Botão Continuar |
| Mochila e coleção | B | Mochila |
| Mapa | M | Minimapa |
| Fechar janelas | Escape | Botão × |
| Batalhar / capturar | Botões da batalha | Botões da batalha |

As janelas e conversas pausam o movimento. O som é opcional, começa desligado e usa pequenos motivos originais sintetizados no navegador. A preferência `prefers-reduced-motion` reduz animações, partículas e efeitos. Controles, diálogos e HP/XP usam HTML com foco de teclado e rótulos; o cenário em si é gráfico.

## Batalhas e progresso

O parceiro ataca primeiro. Se o oponente for nocauteado, não há contra-ataque. Vantagens de tipo causam **2×** de dano, resistências **0,5×**, golpes do próprio tipo recebem **20%** de bônus e críticos têm **10%** de chance, com multiplicador **1,5×**.

Poções curam até **24 HP** e consomem um turno. A captura consome uma bola; a chance vai de 25% com HP cheio até aproximadamente 90% com HP muito baixo. Uma captura que falha permite resposta do adversário. Capturar concede XP; vencer concede XP e uma poção (até 5). Fugir é garantido e não concede XP.

O progresso é salvo neste navegador: parceiro, HP, XP, combate em andamento, coleção, itens, posição, passos e insígnia. Um turno inteiro é salvo antes de sua animação. Os saves da primeira versão são migrados com a posição inicial da vila, sem perder o parceiro ou os níveis. Se o armazenamento for bloqueado, o jogo avisa e continua na sessão. **Recomeçar a jornada** exige confirmação.

## Estrutura

```text
index.html                  Interface, HUD, batalha e diálogos
css/styles.css              Direção visual, layout e efeitos da interface
js/app.js                   Fluxo do jogo, exploração, NPCs, missão e saves
js/engine.js                Motor puro: dano, turnos, captura, XP e validação
js/data.js                  Espécies, tipos, atributos e golpes
js/world-model.js          Mapa determinístico, colisão, NPCs e posição
js/world-renderer.js       Cenas Three.js, iluminação, câmera e efeitos HD-2D
js/pixel-art.js            Sprites locais de Pokémon, treinador, NPCs e vegetação
js/sprite-sheet.js         Leitura de folhas 4 × 4 e animação em quatro direções
js/sprite-assets.js        Registro das folhas de arte externa já disponíveis
js/audio.js                Áudio original via Web Audio, ativado pelo jogador
assets/vendor/             Three.js e licença MIT, para funcionar sem CDN
scripts/serve.mjs          Servidor estático sem dependências de execução
scripts/vendor-three.mjs   Atualização reproduzível dos módulos Three.js locais
scripts/browser-test.mjs   Integração real com Chromium/Playwright
test/engine.test.js        Testes determinísticos de combate e captura
test/world.test.js         Colisão, acesso aos NPCs/gramados e persistência
```

O modelo do mapa é compartilhado por colisão, cenário e minimapa. Sprites são desenhados em baixa resolução e ampliados com filtro de vizinho mais próximo. O terreno, casas, ponte e água são geometria 3D. As sombras do ambiente são armazenadas até a troca de cena; a grama e detalhes usam instâncias para reduzir trabalho gráfico. O pós-processamento combina foco seletivo, brilho suave e gradação de cor, sem etapa de build.

### Integrar novas folhas de sprites

O carregamento aceita folhas quadradas de 4 colunas × 4 linhas, com linhas na ordem **frente, esquerda, direita, costas**. Os quatro quadros de cada linha formam um ciclo de caminhada a 8 quadros por segundo. O parceiro usa a direção do próprio deslocamento e conserva a última direção ao parar; movimento reduzido mantém o primeiro quadro. As batalhas usam os primeiros quadros de frente e de costas.

Quando o PNG original estiver disponível, coloque-o em `assets/sprites/` e registre seu caminho em `js/sprite-assets.js`, por exemplo `charmander: new URL('../assets/sprites/charmander-walk.png', import.meta.url).href`. A folha é dividida na leitura, com transparência preservada e filtro de pixels nítidos. O arquivo deve ter transparência real: um quadriculado desenhado faz parte da imagem e não é removido pelo carregador. Arquivos ausentes ou inválidos mantêm o visual anterior, com aviso. O registro permanece vazio até existir uma imagem real para integrar; as imagens enviadas apenas como prévia no chat não são incluídas automaticamente no projeto.

## Testar

### Lógica — sem instalar dependências

```sh
npm test
```

Testa combate, críticos, vantagens, níveis, poções, captura, coleção, saves antigos/corrompidos, colisão, ponte, regiões e a existência de caminhos da vila até todos os NPCs e gramados.

### Interface e renderização no navegador

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Em Linux mínimo: `npx playwright install --with-deps chromium` pode exigir permissões administrativas. Para um Chromium já instalado, use `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`. O teste usa renderização gráfica por software quando necessário; esse modo pode demorar mais do que uma GPU real.

O teste inicia e encerra seu próprio servidor. Verifica WebGL 2, seleção, movimento por teclado e toque, encontros na grama, NPCs, mapa, mochila, captura, vitórias, níveis, missão, cura, derrota, fuga, saves, recomeço e caminhos relativos equivalentes ao GitHub Pages. Também verifica layouts de 320, 375 e 768 px. Capturas ficam em `test-results/` (ignorado pelo Git). Qualquer falha encerra o comando com código diferente de zero.

### Conferência manual

1. Inicie com cada parceiro e leia as falas da professora.
2. Caminhe até as duas casas, teste a colisão e converse com Clara.
3. Siga ao norte, leia a placa e atravesse a ponte. Confira as mudanças de região e o minimapa.
4. Ande na grama; ataque, use poção e tente capturar. Confira o registro na mochila.
5. Vença 3 encontros, capture um Pokémon e volte à Lia para concluir a missão.
6. Recarregue o site durante a exploração e durante um combate; confira o progresso.
7. Teste som, teclado, celular e preferência de movimento reduzido.

### Atualizar a biblioteca gráfica

O lockfile fixa a versão de Three.js. Depois de uma atualização deliberada da dependência:

```sh
npm ci
npm run vendor
npm test
npm run test:browser
```

Inclua os módulos atualizados de `assets/vendor/` no commit junto do lockfile. A licença MIT de Three.js é preservada em `assets/vendor/LICENSE`.

Projeto de fã, sem afiliação à Nintendo, Game Freak ou The Pokémon Company. Pokémon e nomes relacionados pertencem a seus respectivos titulares. Cenários, sprites em pixel art e motivos sonoros desta versão são gerados localmente pelo projeto.
