# Pokétrilha

Um mini RPG Pokémon em português, feito com **HTML, CSS e JavaScript puro**. Escolha Bulbasaur, Charmander ou Squirtle, explore a Rota 01 e participe de batalhas por turnos. As ilustrações SVG são locais: o jogo não depende de APIs, CDNs, fontes externas ou serviços pagos.

## Executar

Requer **Node.js 20 ou superior**. Na pasta do projeto:

```sh
npm start
```

Abra `http://localhost:3000` no navegador. Não é necessário instalar dependências para jogar nem para executar os testes de lógica. Para outra porta: `PORT=8080 npm start`. Para acesso por outra máquina na rede: `HOST=0.0.0.0 npm start`.

Alternativa com Python: `python3 -m http.server 3000`. Use um servidor HTTP: abrir `index.html` diretamente por `file://` bloqueia módulos JavaScript em alguns navegadores.

## Como jogar

1. Selecione um dos três iniciais e clique em **Começar aventura**.
2. Clique em **Explorar gramado** para encontrar Caterpie, Pidgey, Oddish ou Pikachu.
3. Escolha **Investida** ou o golpe elemental. Seu Pokémon ataca primeiro; o adversário responde se continuar com HP. A interface bloqueia novas ações durante as animações.
4. Considere os tipos: vantagens causam 2× dano e resistências, 0,5×. Golpes do próprio tipo recebem bônus de 20%, há variação de dano e 10% de chance de crítico (1,5×).
5. Uma **poção** recupera até 24 HP e consome o turno. **Fugir** sempre funciona, sem experiência. Fora do combate, **Descansar** recupera todo o HP e repõe 3 poções, inclusive depois de uma derrota.
6. Cada vitória concede experiência e uma poção (até 5). Níveis aumentam HP, ataque e defesa. O limite é nível 20; não há evolução ou captura nesta versão.

O progresso é salvo em `localStorage` depois de cada ação e retomado automaticamente, inclusive em batalhas. O salvamento é local a este navegador e endereço. Se o armazenamento estiver bloqueado, o jogo avisa e continua na sessão. **Começar uma nova jornada** pede confirmação antes de apagar o progresso.

## Estrutura

```text
index.html                 Telas, controles, barras acessíveis e diálogos
css/styles.css             Layout responsivo, temas e animações
js/data.js                 Espécies, tipos, atributos base e golpes
js/engine.js               Combate, encontros, níveis e validação de saves
js/app.js                  Interface, animações, eventos e persistência
assets/                    Ilustrações SVG dos Pokémon, cenário e ícone
scripts/serve.mjs           Servidor estático sem dependências
scripts/browser-test.mjs    Testes de integração com Chromium/Playwright
test/engine.test.js         Testes determinísticos da lógica do jogo
```

O motor é separado do DOM e recebe uma função aleatória opcional. Os testes controlam essa função para verificar resultados sem depender de sorte. Os turnos retornam um novo estado e uma sequência de eventos usada pela interface para animar ataques, cura e resultados.

## Testar

### Lógica — sem instalação

```sh
npm test
```

Verifica os iniciais, encontros, dano, vantagens de tipo, críticos, ordem dos turnos, vitória sem contra-ataque, experiência, múltiplos níveis, limite de nível, poções, fuga, derrota, recuperação e rejeição de salvamentos inválidos.

### Navegador — integração real

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Em Linux mínimo, `npx playwright install --with-deps chromium` também instala bibliotecas do sistema (pode exigir permissões administrativas). Se já houver Chromium instalado, use `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

O teste inicia e encerra seu próprio servidor em uma porta livre. Verifica seleção dos três iniciais, combate, bloqueio de cliques repetidos, cura, vitória, experiência, nível, fuga, derrota, descanso, persistência, recomeço e layouts de desktop e celular. Falhas encerram o comando com código diferente de zero. Capturas de tela ficam em `test-results/` (ignorado pelo Git).

### Roteiro manual

- Use Tab e Enter para selecionar um inicial, iniciar, explorar e escolher golpes. Abra **Como jogar** e feche com Escape.
- Observe o HP diminuir, os golpes animarem e o diário registrar cada turno. Cliques rápidos não devem gerar turnos extras.
- Use poção com HP reduzido; com HP cheio, ela fica desabilitada. Fuja, descanse e explore de novo.
- Vença encontros até subir de nível; confira a experiência e o aumento de HP. Depois de perder, descanse para continuar.
- Recarregue durante uma batalha e confira o progresso restaurado. Cancele e confirme o recomeço.
- Teste em uma largura de 375 px e com a preferência de movimento reduzido do sistema.

## Detalhes

Sem etapa de build, banco de dados ou credenciais. Compatível com navegadores modernos com módulos ES e `<dialog>`. A preferência `prefers-reduced-motion` reduz as animações; barras de HP/XP, controles, foco e mensagens possuem suporte a acessibilidade.

Projeto de fã, sem afiliação à Nintendo, Game Freak ou The Pokémon Company. Pokémon e nomes relacionados pertencem a seus respectivos titulares.
