# @venore/plugin-games — arquitetura

Sucessor genérico do `@venore/plugin-erasto-league`. Uma ferramenta pra qualquer competição do
colégio: do campeonato de recreio (uma modalidade, um torneio) até as "olimpíadas" do Erasto Games
(várias modalidades — futsal, vôlei, dança, e-sports, arrecadação — somando pontos num quadro
geral). Cada instância do Venore Docks (ex: `erasto-league`, `erasto-games`) instala o plugin e o
tema `@venore/theme-games`.

## 1. Modelo de domínio

```
competição (edição: "Erasto League 2026", "Erasto Games 2026")
├── equipes (participants)         — turmas/times; brasão, cores, slug
│   └── atletas (athletes)         — pessoa da equipe; foto, número, posição, gênero, capitão
├── modalidades (modalities)       — futsal, vôlei, dança…; perfil esportivo + regras
│   ├── inscrições                 — quais equipes disputam esta modalidade
│   ├── fases (stages)             — liga, grupos, mata-mata, prova única
│   │   ├── grupos (stage_groups)
│   │   └── jogos (matches)        — agendados → ao vivo → encerrados; slots com origem
│   │       ├── lances (match_events)
│   │       └── power plays (match_boosts)
│   ├── resultados de prova (stage_results) — nota/medida/colocação por equipe
│   └── colocação final (modality_placements)
├── tabela de pontos do quadro geral (por colocação, configurável, peso por modalidade)
├── ajustes manuais (score_adjustments) — bônus/penalidade com motivo
├── votações da torcida (vote_polls + votes)
└── canais ao vivo (live_channels) — "Quadra 1", "Quadra 2": qual jogo está no overlay/TV
```

- **Competição ativa**: o site mostra uma competição por vez (setting `games.activeCompetitionId`);
  edições anteriores continuam no banco.
- **Campeonato simples** = competição com uma modalidade e quadro geral desligado.
- **Jogo é uma entidade só**, do agendamento ao resultado. Some a dupla "fixture + match" do plugin
  antigo e, com ela, a classe de bug do vínculo manual/automático (confronto errado, confronto
  duplicado).

### Perfis esportivos (código, não banco)

Cada modalidade escolhe um perfil (`shared/sport-profiles.ts`) que define unidade do placar,
botões do controle, tipos de lance, relógio e regra de vitória:

| Perfil | Placar | Relógio | Lances | Vitória |
| --- | --- | --- | --- | --- |
| `futsal` / `futebol` | gols (+1, opcional +0,5) | tempos crescentes | gol, amarelo, vermelho, falta | maior placar, empate permitido em liga |
| `volei` | sets + pontos do set | — | ponto, set | sets |
| `basquete` | pontos (+1/+2/+3) | quartos | cesta, falta | maior placar |
| `handebol` | gols | tempos | gol, amarelo, 2 min, vermelho | maior placar |
| `pontos` | pontos genéricos | opcional | ponto | maior placar |
| `esports` | rounds/mapas | — | round | maior placar |
| `nota` (dança, apresentação) | — | — | — | prova única: média das notas |
| `medida` (arrecadação, tempo, distância) | — | — | — | prova única: maior (ou menor) valor |
| `colocacao` | — | — | — | prova única: ordem lançada pelo admin |

Configuração por modalidade (jsonb validado): minutos × tempos, meio ponto, pontos por
vitória/empate/derrota, critérios de desempate, unidade da medida, "menor é melhor".

## 2. Torneios: formatos, fases e templates

Uma modalidade tem fases em ordem. Tipos de fase:

- **Pontos corridos** (`round_robin`) — um grupo ou vários (fase de grupos); turno ou turno e
  returno; gera os confrontos automaticamente (método do círculo).
- **Mata-mata** (`knockout`) — N participantes, **qualquer N** (6 na quartas: os 2 melhores
  ganham bye); disputa de 3º opcional; jogo único. Cada slot de jogo aponta pra uma **origem**
  (`1º do Grupo A`, `vencedor do jogo X`, `perdedor do jogo Y`, equipe fixa) — o avanço é
  automático quando a origem resolve, e o admin pode sobrescrever qualquer slot à mão.
- **Prova única** (`single_event`) — todas as equipes de uma vez (dança, arrecadação); resultado é
  nota/medida/colocação por equipe.

Classificação de fase de grupos: pontos → critérios configuráveis (vitórias, saldo, gols pró,
confronto direto, menos cartões, sorteio/nome). A tabela de grupo usa **só os jogos daquele grupo**
(corrige o bug do plugin antigo que somava jogos de fora).

**Templates**: formatos prontos no código (Liga, Liga ida e volta, Grupos + mata-mata, Mata-mata,
Prova única por nota, Prova única por medida) e templates salvos pelo admin
(`tournament_templates`, definição em jsonb). Aplicar um template numa modalidade cria as fases,
grupos e slots; os jogos são gerados a partir das inscrições.

## 3. Quadro geral (Erasto Games)

`pontos da equipe = Σ modalidades (tabela_colocação[posição] × peso_modalidade) + Σ ajustes`

- Tabela por colocação configurável na competição (padrão 1º=100, 2º=80, 3º=65, 4º=55, 5º=45…),
  com override por modalidade.
- Colocação final da modalidade: calculada das fases (campeão do mata-mata, ordem da prova única,
  classificação da liga) ou fixada à mão pelo admin.
- Ajustes manuais com motivo, opcionalmente ligados a uma modalidade.
- Quadro geral só considera modalidades "finalizadas" (ou mostra parcial, configurável).

## 4. Custo do servidor

As páginas públicas do core são `force-dynamic` (cada visita renderiza no servidor). O plugin
antigo fazia dezenas de consultas por página e um `getMediaAsset` por imagem. Agora:

1. **Snapshot por versão.** Cada escrita incrementa `games.competitions.data_version` (na mesma
   transação). Leitura pública = 1 consulta da versão + snapshot em memória
   (`getCache`/`setCache` do SDK) com chave `competição:versão`. Instância nova ou versão nova →
   recarrega tudo em ~6 consultas em lote (equipes, atletas, mídia em lote, jogos, lances
   agregados, resultados). Todos os blocos da página leem o mesmo snapshot.
2. **`cache()` do React** por request — breadcrumb, metadata e página não repetem consulta.
3. **Ao vivo sem banco por conexão.** Um único poller por instância (globalThis) lê
   `match_live.version` dos jogos ao vivo a cada 1s e notifica todas as conexões SSE daquela
   instância; o SSE só manda snapshot quando a versão muda. Páginas públicas usam
   `/api/games/live` (JSON pequeno, `s-maxage=2, stale-while-revalidate`) — a CDN absorve o pico.
4. **Imagens nunca no caminho público** (seção 5).
5. **Paginação** em listas que crescem (jogos, resultados).

## 5. Capa e story pré-gerados

Ao salvar a foto do jogo, encerrar o jogo ou corrigir o placar, o servidor gera **uma vez**:

- `cover` 1280×720 (YouTube e preview do WhatsApp/`og:image`);
- `story` 1080×1920 (Instagram/WhatsApp status);

e grava as duas no sistema de mídia do host (MMS/Blob), guardando os ids em `matches`. Quem acessa
só baixa o arquivo pronto (URL do Blob/variante). A geração roda depois da resposta
(`after()`), com hash dos dados de entrada: se nada mudou, não regera. Stories de atleta e da
votação seguem o mesmo esquema (gerados no admin, invalidados quando os dados mudam).

## 6. Votação da torcida (sem login, mais rígida)

Brechas do plugin antigo e correções:

| Brecha | Correção |
| --- | --- |
| Espera contada por ticket, tickets "envelhecem" em paralelo | Espera **acumulada por rede**: cada ticket emitido reserva o próximo horário livre daquela rede (`vote_network_slots.next_slot_at`) dentro de um lock; 30 tickets de uma vez esperam 5s, 10s, 15s… somados |
| Ticket não preso a ninguém | Ticket assinado com hash da rede + do aparelho; voto de outra rede/aparelho é recusado |
| Emissão de ticket sem limite | Rate limit na emissão (por rede) |
| IP de cabeçalho forjável fora da Vercel | IP vem só do cabeçalho de confiança configurado (`x-vercel-forwarded-for` na Vercel); sem IP → voto exige Turnstile |
| Segredo fixo quando falta `AUTH_SECRET` | Sem segredo, votação fica fechada (falha fechada) |
| Troca do Time favorito pagava como voto novo / burlava teto | Troca não conta como voto novo da rede; teto vale por aparelho e por rede |
| "Manter 1 por navegador" sem transação | Ações de auditoria em transação |

Parciais servidas do snapshot (seção 4), com contagem agregada mantida por gatilho na transação do
voto (`vote_tallies`), nunca `COUNT(*)` por visita.

## 7. Segurança e robustez

- Toda Server Action valida a permissão **e** o input (ids uuid, enums por lista permitida).
- Id malformado na URL → 404 (não 500).
- Escritas em várias tabelas sempre em transação.
- Iniciar jogo ao vivo quando já existe outro no mesmo canal pede confirmação explícita.
- Correção de placar nunca deixa o placar negativo nem "come" lance futuro (o lance negativo é
  rejeitado se passar de zero).

## 8. Migração do Erasto League

Ferramenta no admin (`/admin/games/migrar`), idempotente: lê o schema `erasto_league` e cria uma
competição com uma modalidade de futsal, equipes (mesmos ids de mídia), atletas, fases (grupos +
mata-mata reconstruídos a partir dos confrontos), jogos (confronto + partida viram um jogo só),
lances, power plays, MVP, links do YouTube, votos e configurações. Links antigos
`/erasto-league/...` continuam funcionando via redirecionamento.
