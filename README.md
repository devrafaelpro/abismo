# ABISMO — mergulhe fundo, volte vivo

Caça ao tesouro no fundo do mar, feita para o celular. Cada mergulho é uma aposta: o ar acaba, a luz some, e lá embaixo tem coisa que não quer você por perto. Se voltar, fica rico. Se desmaiar, o saque afunda.

Instala como app no iPhone (Safari → Compartilhar → **Adicionar à Tela de Início**) e funciona offline.

## Como se joga

- **Toque e segure**: o mergulhador nada até o seu dedo.
- Pegue moedas, pérolas, pedras, barras de ouro. Fique parado perto de um **baú** para abri-lo.
- **Volte antes do ar acabar.** A bolsa pesa, a correnteza empurra, o HUD avisa quando é hora de subir.
- Chegou com o ar no zero? **Bônus de 25% por um triz.**

## O que tem lá embaixo

- **Zonas**: Recife de Coral, Cemitério de Navios, Paredão Azul, Zona do Crepúsculo, Zona da Meia-Noite, Fontes Hidrotermais, Planície Abissal, Fossa Hadal, Atlântida, Núcleo Cristalino e o Abismo Sem Fim (infinito).
- **Criaturas**: águas-vivas, moreias que saem das paredes, tubarões que rondam antes de atacar (e derrubam seu saque), peixes-diabo com isca de luz e a lula colossal que te arrasta para o fundo.
- **Artefatos** únicos por zona, que vão para o museu e aumentam o valor de tudo.
- Escuridão real: só enxerga o que a sua lanterna ou a bioluminescência iluminam.

## Progressão

- **Equipamento**: roupa de pressão, cilindro, nadadeiras, bolsa, lanterna, ímã, sonar e arpão automático.
- **Estações submarinas**: pontos de partida cada vez mais fundos.
- **Frota**: mergulhadores contratados rendem dinheiro o tempo todo (até 8h com o app fechado).

## Rodar localmente

Sem build e sem dependências (HTML, CSS e JavaScript puro, tudo desenhado em canvas).

```bash
npm run dev              # http://localhost:5518
node scripts/sim.mjs 300 # robô joga 300 mergulhos para medir o ritmo
```

## Estrutura

- `js/dive.js` — física do mergulho, ar, criaturas, saque
- `js/world.js` — abismo procedural (paredes fixas, tesouros e criaturas novos a cada mergulho)
- `js/render.js` — água, luz, escuridão, criaturas, superfície
- `js/audio.js` — som sintetizado: respiração, coração, tubarão, baleias
- `js/data.js` / `js/state.js` — conteúdo, economia e save
- `js/ui.js` / `js/main.js` — telas e laço principal
