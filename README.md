# tripsz

Roteiros de viagem em torno de jogos de futebol (groundhopping). A pessoa escolhe
países, datas e times favoritos; a tripsz cruza com o calendário de jogos reais e
devolve a melhor sequência de cidades, em três opções de roteiro (A, B e C).
Quem assina o **Passaporte de Estádios** também registra os jogos a que foi, ganha XP, conquistas
e aparece no ranking de torcedores.

## Stack

- **Next.js 14** (App Router) + **React 18**, publicado na **Vercel**
- **Supabase**: login (Google e e-mail/senha), banco de dados e storage
  (buckets `avatars` e `team-logos`)
- **Mercado Pago**: assinatura recorrente do Passaporte de Estádios (API de Preapproval) e
  pagamento avulso da consultoria (Checkout Pro)
- **API-Football** (api-sports.io): jogos, times e estádios — usada só no servidor
- **PWA**: `app/manifest.js`, ícones e tela de carregamento estática em `app/layout.js`

## Como o código está organizado

```
app/
  page.js, [...slug]/page.js   renderizam o mesmo app (rota coringa evita 404 no F5)
  u/[slug]/                    perfil público de um torcedor
  admin/page.js                painel administrativo
  termos/, privacidade/, redefinir-senha/
  api/
    trip/plan                      monta o roteiro com jogos reais
    games/search                   Buscar Jogos por cidade (data + raio)
    games/browse                   Buscar Jogos por país, liga ou clube (lê só do fixtures_calendar, sem gastar API)
    venues/photo                   Foto real do estádio (Wikipedia) quando a API-Football não tem
    attended-games/*               Registrar Jogo (busca por estádio/time)
    teams/*, cities/suggest        escudos e sugestões de times e cidades
    ranking, profile/*, public-profile/[slug]
    subscribe/*                    assinar, cancelar, trocar cartão, faturas
    checkout, webhook              pagamento avulso e avisos do Mercado Pago
    consultoria/availability
    admin/*                        usuários, assinaturas, finanças, ligas etc.
components/
  TripszApp.jsx                só o App: estado geral e troca de telas
  routes.js                    mapa tela ⇄ URL (SCREEN_TO_PATH / PATH_TO_SCREEN)
  ui/                          peças visuais: Button, Badge, Pill, Icon, Wordmark, Loading...
  nav/                         menus: TopNavPublic, AuthedNav, AuthedFooter, WizardChrome
  landing/                     página inicial
  auth/                        criar conta, login, redefinir senha
  wizard/                      passos do questionário e tela de cálculo
  roteiro/                     resultado A/B/C, detalhe e Meus Roteiros
  checkout/                    pagamento avulso da consultoria
  conta/                       conquistas, ranking, nível, perfil, assinatura, paywall
  jogos/                       Buscar Jogos, Meu Calendário, Meus Jogos, Registrar Jogo
  jogos/detalhes/              modal "Detalhes da experiência" (Meus Jogos): uma aba por arquivo
  TeamBadge.jsx                escudo do time, com várias fontes e fallback
  SocialLinks.jsx              redes sociais do rodapé (o endereço do Instagram fica aqui)
lib/
  tripPlanner.js               motor de roteiros (lógica pura, sem rede/banco)
  tripOptions.js               monta as opções A / B / C a partir do plano
  fixturesCalendar.js          calendário de jogos reais (servidor)
  calendarCore.js, calendarUtils.js, fixtureLocation.js, gamesSearch*.js, gamesBrowse.js
  footballApi.js               cliente da API-Football
  supabase.js                  clientes do Supabase (navegador e admin)
  tokens.js                    cores e fontes
  tripPlanClient.js            chama /api/trip/plan e converte o plano para a tela
  passportAccess.js            quem tem acesso ao Passaporte de Estádios (limite de 20 jogos grátis)
  gameSeason.js, seasons.js    temporada de um jogo (europeia ou ano-calendário)
  searchKey.js                 normaliza nomes de busca (acento, til, hífen, apóstrofo)
  gameDetailsCore.js           detalhes de um jogo (escalação, gols, estatísticas): lógica pura
  gameDetails.js               busca na API-Football + cache desses detalhes (só servidor)
  xpRules.js                   regra de XP: total e XP gerado por cada jogo
  fanLevels.js                 categorias de torcedor (nomes, faixas de XP e textos)
  data/                        cidades, clássicos (rivalries), geoExtras
```

### Navegação

O app é uma página só com roteamento próprio: o mapa `SCREEN_TO_PATH` em
`components/routes.js` liga cada tela a uma URL (`/roteiro/destino`, `/conta/jogos`, ...).

- **Montar viagem:** landing → criar conta → destino → times → datas →
  pessoas e orçamento → preferências → cálculo → resultado (A/B/C) → checkout
- **Área logada:** Meus Roteiros, Buscar Jogos, Meu Calendário, Registrar Jogo,
  Meus Jogos, Meu Nível, Minhas Conquistas, Ranking, Meu Perfil, Minha Assinatura

### Motor de roteiros

- Usa **somente jogos reais**: não inventa preço, atmosfera nem passeio.
- Janela de datas com folga conforme a flexibilidade: fixa = 0, alguma = ±7, flexível = ±21 dias.
- O ritmo é o número de dias livres entre jogos; a distância entre cidades define
  quantos dias a viagem exige. Máximo de 10 jogos.
- Jogo de time favorito pesa mais que qualquer prioridade; clássicos ganham bônus;
  local provável (estádio inferido) é levemente penalizado; distância só desempata.
- **Cada país pedido entra no roteiro quando for viável** (bônus de cobertura, uma vez por
  país; até 4 países por conta). Se algum não entrar, um aviso diz o motivo (sem jogo no
  período, ou não coube por ritmo/deslocamento) e mostra os jogos reais mais próximos dele.
- Time favorito é reconhecido pelo **ID** (os da lista fixa, `lib/teamLogoIds.js`) ou pelo
  **nome** (os escolhidos na busca `/api/teams/suggest`, que devolve o nome como a API escreve).
- Quando algo não dá certo (sem jogo nas datas, favorito que não joga), avisa e
  mostra os jogos reais mais próximos, em vez de trocar em silêncio.
- Opções: **A** foco nos jogos (recomendada), **B** jogos + cultura (1 dia livre
  antes e depois), **C** uma cidade só (aparece se o roteiro passa por 2+ cidades).

### Calendário de jogos

`lib/fixturesCalendar.js` guarda os jogos de cada liga na tabela `fixtures_calendar`,
já com cidade, coordenada e país. Antes de cada consulta só as ligas dos países
pedidos são conferidas; se foram atualizadas há menos de 12 h, nem vai à API.
O horizonte guardado é de 270 dias, mas a busca de jogos e as datas do roteiro aceitam só até 6 meses à frente (`maxSearchDate`); sem jogo na data pedida, a busca mostra os mais próximos (±10 dias) no mesmo raio. A busca de uma pessoa lê da tabela e não gasta cota.

### Gamificação

XP = jogos registrados × 50 + estádios × 100 + países × 200 + conquistas × 150
(`lib/xpRules.js`). Só jogos **registrados** contam; gerar um roteiro não dá XP.
Em Meus Jogos, cada jogo mostra o XP que gerou (jogo + estádio novo + país novo + conquista
que ele desbloqueou); a soma dos jogos sempre fecha com o total.
Os textos das categorias de torcedor ficam em `lib/fanLevels.js`.

### Detalhes da experiência (modal de Meus Jogos)

"Ver detalhes da experiência" abre um modal com 5 abas: **Escalação** (campo com os 11 de cada
time, reservas e técnico), **Gols** (linha do tempo com placar corrido; no desktop, resumo ao lado),
**Estádio** (capacidade, cidade, país e visitas da pessoa), **Estatísticas** (barras mandante x
visitante) e **XP** (o que o jogo rendeu, próxima categoria e compartilhar). No celular abre como
folha de baixo pra cima; no desktop, centralizado (Figma 516:*).

- Os dados vêm de `GET /api/games/details?gameId=...` (exige login; só devolve jogo da própria
  pessoa). Jogo registrado **à mão** não tem `api_fixture_id`: só as abas Estádio e XP têm dados.
- Cada jogo ENCERRADO é consultado na API-Football uma vez só (1 chamada pelo jogo + 1 pelo
  estádio, se ele ainda não estiver em `venues_cache`) e fica em `fixture_details_cache`. Se a
  tabela não existir, funciona igual (cache em memória), só gasta mais cota.
- A foto do estádio é `media.api-sports.io/football/venues/<id>.png`; se falhar, usa a foto de
  reserva `STADIUM_FALLBACK_IMAGE` (`components/jogos/detalhes/AbaEstadio.jsx`).
- Editar local e Remover jogo ficam no próprio cartão (o cartão não expande mais).

### Quem foi com você? (marcar amigos e convidar)

Depois de registrar um jogo, a pessoa marca quem foi com ela. **Quem já tem conta NÃO recebe o jogo sozinho**: recebe um
aviso ("Fulano te marcou em [jogo]") com "Adicionar ao meu Passaporte" ou "Ignorar", então ninguém grava dado em conta
alheia nem infla o XP/ranking de outra pessoa. Quem não tem conta entra por convite (seção acima).

- **Telas** (`components/jogos/acompanhantes/*`): `QuemFoiComVoce` (etapa depois do registro), `ConvidarModal`, `JogoSalvo`
  (confirmação + "Seus convites"), `DetalhesJogoModal` (abre pela linha "Com Ana e Bruno" em Meus Jogos; o modal de 5 abas
  continua sendo o "Ver detalhes da experiência") e `MarcacoesPendentes` (os avisos, no topo de Meus Jogos).
- **Registrar Jogo**: o registro manual segue pra "Quem foi com você?"; nos jogos adicionados pela busca (que podem ser vários),
  cada cartão ganha o link "+ Quem foi com você?". O jogo já está salvo nessa etapa; "Salvar jogo" ali salva as marcações.
- **Servidor**: `lib/companion*.js` e `app/api/{friends,games/companions,games/[gameId]/companions,companion-requests}`. Tabela
  `game_companions` (`supabase-acompanhantes.sql`, RLS ligado e sem política).
- **Busca de amigos**: pelo `@` EXATO (`profiles.username`), mínimo de 3 caracteres, devolve no máximo uma pessoa (nunca lista
  usuários), 15 buscas/min por pessoa. "Amigo" (sugestões) = quem você já marcou ou convidou e que tem conta.
- **Limites**: 10 marcados por jogo, 30 marcações por dia. Quem ignora a marcação continua "aguardando" para quem marcou.
- **Convite**: WhatsApp/e-mail abrem já com a mensagem (o telefone/e-mail digitado só monta o link e nunca é guardado); no celular
  há também o compartilhamento nativo. "Enviado" significa "convite criado"; só "Cadastrou" é confirmado.

## Variáveis de ambiente
### Convites de jogo ("Quem foi com você?")

Quem registrou um jogo pode convidar quem estava com ele. Quem recebe o link cria a conta (ou entra) e o jogo
cai no Passaporte dela. **Fase 1 (feita): o lado de quem RECEBE e todo o servidor.** A tela que CRIA o convite
("Convidar alguém novo") e a marcação de amigos que já têm conta (com aceite) são as fases seguintes.

- **Página pública:** `/convite/<código>` (`components/convite/*`, estado e ações em `useConvite.js`). Estados: válido
  (cadastro), expirado, já usado (login), link inexistente, dono do convite, pessoa já logada. Não é indexada.
- **Boas-vindas:** `/conta/bem-vindo` (`components/conta/BoasVindasConvite.jsx`), com os dados do resgate guardados no navegador.
- **Servidor:** `lib/inviteServer.js` (criar, listar, reenviar), `lib/inviteRedeem.js` (página pública e resgate) e
  `lib/inviteShared.js`; rotas em `app/api/invites/*`. Tabela `game_invites` (`supabase-convites.sql`): RLS ligado e sem política.
- **Segurança:** o código tem 128 bits e **só o hash** vai pro banco; vale 14 dias, uso único; "Reenviar" cria link novo e
  invalida o anterior; limite de 20 convites por pessoa por dia (+ limites por minuto em memória, `lib/rateLimit.js`);
  o convite guarda uma **cópia** do jogo; resgate idempotente, sem duplicar, e o dono não resgata o próprio.
  Guarda só o **nome** digitado de quem foi convidado (nunca telefone ou e-mail).
- **Resgate depois do Google/confirmação de e-mail:** o código fica em `localStorage` (`tripsz_pending_invite`, 14 dias) e o
  app (`TripszApp.jsx`) resgata na primeira sessão (`SIGNED_IN`/`INITIAL_SESSION`), pelo CÓDIGO, nunca pelo e-mail digitado.
- **Quem convida aparece** como primeiro nome + `@` (`profiles.first_name` e `profiles.username`); sobrenome nunca sai.
Configure na Vercel (Settings → Environment Variables) e, para rodar local, copie `.env.example` para `.env.local` e preencha.

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de servidor do Supabase (**nunca** expor no navegador) |
| `MERCADOPAGO_ACCESS_TOKEN` | token do Mercado Pago (teste ou produção) |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | chave pública (troca de cartão) |
| `FOOTBALL_API_KEY` | chave da API-Football |
| `ADMIN_EMAILS` | e-mails com acesso ao `/admin`, separados por vírgula |
| `NEXT_PUBLIC_FREE_ACCESS_EMAILS` | e-mails com Passaporte de Estádios liberado sem pagar |
| `NEXT_PUBLIC_SITE_URL` | URL do site (ex.: `https://tripsz.vercel.app`) |

## Banco de dados

`supabase-schema.sql` é o schema real de produção (exportado do Supabase em 09/10/2026):
tabelas, índices e políticas de RLS. Rodando esse arquivo num projeto novo e criando os
buckets públicos `avatars` e `team-logos` em Storage, o ambiente volta do zero.

- **Dados de pessoas** (RLS: cada um só vê/edita o que é seu): `trip_answers`, `orders`,
  `subscriptions`, `attended_games`, `saved_games`, `public_profiles`.
- **Caches só do servidor** (RLS ligado e sem política, de propósito: só a chave
  `service_role` acessa): `fixtures_cache`, `fixtures_fetch_log`, `fixtures_calendar`,
  `calendar_sync_log`, `team_home_venues`, `venues_cache` e `team_logos`.
- `newsletter_subscribers`: qualquer pessoa pode se inscrever.
- **Pendente de rodar:** `supabase-fixture-details-cache.sql` cria `fixture_details_cache` (cache só do
  servidor, como os de cima). Depois de rodar, incorpore o trecho ao `supabase-schema.sql`.

As tabelas antigas `leagues` e `fixtures` foram apagadas; uma cópia ficou no schema
`backup` do Supabase e pode ser removida quando você quiser.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # e preencha as variáveis
npm run dev
```

Abre em http://localhost:3000

## Publicando

1. Suba o repositório no GitHub e importe na Vercel.
2. Cadastre as variáveis de ambiente.
3. Não há cron: o calendário de jogos se atualiza sozinho quando alguém consulta
   (ligas atualizadas há menos de 12 h nem vão à API).
4. No Mercado Pago, aponte o webhook para `/api/webhook` e confira as URLs de
   retorno com o domínio real. Comece pelas credenciais de teste.
5. No Supabase, em Authentication → URL Configuration, cadastre o domínio do site.

## Segurança das rotas

As rotas de assinatura, checkout, perfil e do painel admin **não confiam** em `userId`/e-mail enviados pelo navegador. O navegador manda o token de login (`lib/authFetch.js`) e o servidor o confere com o Supabase (`lib/serverAuth.js`): o usuário vem do token, e o admin é quem está logado **e** com e-mail em `ADMIN_EMAILS`. Ao criar uma rota nova que depende de quem é a pessoa, use `authUser(request)` ou `requireAdmin(request)`.

## Pendências conhecidas


- No Supabase: remover a política duplicada `usuário edita suas respostas` em `trip_answers` e ligar a proteção contra senhas vazadas (Authentication → Providers → Email).
- O schema `backup` do Supabase pode ser removido depois de conferido.

## Priorização de jogos principais

`lib/gameImportance.js` pontua cada jogo (competição: Champions/Libertadores > Europa/Sul-Americana > 1ª divisão > copas; fase; clubes grandes). O planner soma essa importância ao peso, então mesmo sem clubes favoritos as 3 opções (A, B, C) preferem os jogos principais. Favoritos continuam acima de tudo. A lista de clubes é estática (grafias da API).

## Pagamentos (checkout transparente Mercado Pago)

- Passaporte mensal: cartão, assinatura recorrente (`/api/subscribe` com `cardTokenId`).
- Passaporte anual: cartão (recorrente) ou Pix avulso de 365 dias (`/api/subscribe/pix`, sem renovação automática; acesso até `subscriptions.current_period_end`).
- Consultoria: Pix ou cartão via `/api/checkout` (API de Pagamentos); o Pix é confirmado por `/api/checkout/status` e pelo webhook.
- Tela: `components/pagamento/PagamentoModal.jsx` (Card Payment Brick + QR Code Pix). Precisa de `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` e `MERCADOPAGO_ACCESS_TOKEN`.
- Migração aplicada: coluna `subscriptions.mercadopago_payment_id`.

## @usuário, nome e sobrenome

- Cadastro pede **Nome**, **Sobrenome** e **@usuário** (`components/auth/NomeUsuarioFields.jsx`); `user_metadata.name` continua sendo "Nome Sobrenome".
- Regras do @ em `lib/username.js` (3–20 caracteres, a–z, 0–9, `.` e `_`, sem repetição) e conferência em `GET /api/username/check`.
- Unicidade garantida no banco: `supabase-profiles-username.sql` (rodar uma vez no SQL Editor) cria `public.profiles` (índice único no @), as funções que geram o @ e um gatilho em `auth.users`. Quem entra com Google recebe `nome.sobrenome` (com número se já existir).
- O link público do perfil passa a ser o próprio @.
