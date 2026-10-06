# @venore/plugin-games

Competições escolares no Venore Docks — do campeonato de recreio às "olimpíadas" com várias
modalidades e quadro geral. Sucessor genérico do `@venore/plugin-erasto-league`. Arquitetura e
decisões: [`docs/arquitetura.md`](docs/arquitetura.md).

## O que faz

- **Competição → modalidades → fases → jogos.** Cada modalidade escolhe um perfil esportivo
  (futsal, futebol, vôlei, basquete, handebol, pontos, e-sports, nota de jurados, medida,
  colocação) que define placar, botões do controle, lances e relógio.
- **Torneios configuráveis.** Pontos corridos (turno ou turno e returno, um ou vários grupos),
  mata-mata com **qualquer número de equipes** (os melhores folgam: 6 na quartas → 2 byes), disputa
  de 3º, prova única. Vagas do mata-mata com origem ("1º do Grupo A", "Vencedor J3") preenchidas
  sozinhas quando a origem resolve; o admin pode travar e editar qualquer vaga. Formatos prontos +
  **templates salvos** a partir de uma modalidade.
- **Classificação** com critérios de desempate configuráveis (vitórias, saldo, pró, confronto
  direto, cartões, nome); tabela de grupo usa só os jogos do grupo.
- **Quadro geral** (Erasto Games): pontos por colocação (tabela configurável, peso e tabela própria
  por modalidade) + ajustes manuais com motivo; desempate por medalhas.
- **Jogo ao vivo** por canal (vários jogos simultâneos): controle no celular
  (`/ext/games/controle`), overlay OBS (`/ext/games/overlay`), TV com rodízio (`/ext/games/tv`).
  Placar sempre derivado dos lances (desfazer apaga o lance — nunca placar negativo nem gol
  "fantasma" na artilharia).
- **Votação da torcida sem login** (craque do jogo + equipe favorita) com espera acumulada por rede,
  ticket preso a votação/aparelho/rede, auditoria por rede e Turnstile opcional.
- **Capa 16:9 e story 9:16 pré-gerados** a partir da foto do jogo e salvos no sistema de mídia; o
  site e o WhatsApp só baixam o arquivo pronto.
- **Blocos de page-builder** e **páginas prontas** (seed "Páginas do site": Início, Agenda,
  Classificação, Modalidades, Equipes, Jogos, Destaques + menu), editáveis no CMS.
- **Migração do Erasto League** (`/admin/games/importar`) preservando ids/slugs; links antigos
  `/erasto-league/...` redirecionam.

## Custo de servidor

Leitura pública por **snapshot versionado**: cada escrita sobe `competitions.data_version`; cada
visita faz 1 consulta (a versão) e lê o snapshot em memória. Ao vivo: um poller por instância para
todo SSE, endpoint JSON com cache curto na CDN. Voto não invalida o snapshot (parcial com cache de
10 s). Nenhuma imagem é gerada em rota pública.

## Variáveis de ambiente

| Variável | Pra quê |
| --- | --- |
| `AUTH_SECRET` | Obrigatória pra votação (HMAC de rede/ticket). Sem ela a votação fica fechada. |
| `GAMES_TRUSTED_IP_HEADER` | Fora da Vercel: cabeçalho de IP do proxy reverso de confiança. Na Vercel não precisa. |
| `GAMES_TURNSTILE_SITE_KEY` / `GAMES_TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (opcional) na votação. |
| `AUTH_URL` | Origem pública do site (og:image, links). Sem ela, usa o host do request. |

## Rodar contra o host

```bash
# no venore-docks
npm pkg set dependencies.@venore/plugin-games="file:../venore-plugin-games"
npm install && npm run gen:registries && npm run dev
```

`/admin/plugins` → instalar **Games** (migration `games`) → `/admin/games`. Páginas do site:
"Popular dados de exemplo" no card do plugin (seed "Páginas do site").

## CI

`.github/workflows/ci.yml`: instala este checkout no `venore-docks` (`main`) e roda typecheck, lint
com as regras do host e `npm run test:plugins`.
