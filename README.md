# tripsz

Roteiros de viagem em torno de jogos de futebol (groundhopping). A pessoa escolhe
países, datas e times favoritos; a tripsz cruza com o calendário de jogos reais e
devolve a melhor sequência de cidades, em três opções de roteiro (A, B e C).
Quem assina o **Passport** também registra os jogos a que foi, ganha XP, conquistas
e aparece no ranking de torcedores.

## Stack

- **Next.js 14** (App Router) + **React 18**, publicado na **Vercel**
- **Supabase**: login (Google e e-mail/senha), banco de dados e storage
  (buckets `avatars` e `team-logos`)
- **Mercado Pago**: assinatura recorrente do Passport (API de Preapproval) e
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
    games/search                   Buscar Jogos
    attended-games/*               Registrar Jogo (busca por estádio/time)
    teams/*, cities/suggest        escudos e sugestões de times e cidades
    ranking, profile/*, public-profile/[slug]
    subscribe/*                    assinar, cancelar, trocar cartão, faturas
    checkout, webhook              pagamento avulso e avisos do Mercado Pago
    consultoria/availability
    admin/*                        usuários, assinaturas, finanças, ligas etc.
components/
  TripszApp.jsx                telas e navegação do app inteiro
  TeamBadge.jsx                escudo do time, com várias fontes e fallback
lib/
  tripPlanner.js               motor de roteiros (lógica pura, sem rede/banco)
  tripOptions.js               monta as opções A / B / C a partir do plano
  fixturesCalendar.js          calendário de jogos reais (servidor)
  calendarCore.js, calendarUtils.js, fixtureLocation.js, gamesSearch*.js
  footballApi.js               cliente da API-Football
  supabase.js                  clientes do Supabase (navegador e admin)
  tokens.js                    cores e fontes
  data/                        cidades, clássicos (rivalries), geoExtras
```

### Navegação

O app é uma página só com roteamento próprio: o mapa `SCREEN_TO_PATH` em
`TripszApp.jsx` liga cada tela a uma URL (`/roteiro/destino`, `/conta/jogos`, ...).

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
- Quando algo não dá certo (sem jogo nas datas, favorito que não joga), avisa e
  mostra os jogos reais mais próximos, em vez de trocar em silêncio.
- Opções: **A** foco nos jogos (recomendada), **B** jogos + cultura (1 dia livre
  antes e depois), **C** uma cidade só (aparece se o roteiro passa por 2+ cidades).

### Calendário de jogos

`lib/fixturesCalendar.js` guarda os jogos de cada liga na tabela `fixtures_calendar`,
já com cidade, coordenada e país. Antes de cada consulta só as ligas dos países
pedidos são conferidas; se foram atualizadas há menos de 12 h, nem vai à API.
O horizonte é de 270 dias. A busca de uma pessoa lê da tabela e não gasta cota.

### Gamificação

XP = jogos registrados × 50 + estádios × 100 + países × 200 + conquistas × 150.
Só jogos **registrados** contam; gerar um roteiro não dá XP.

## Variáveis de ambiente

Configure na Vercel (Settings → Environment Variables) e, para rodar local, em `.env.local`.

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de servidor do Supabase (**nunca** expor no navegador) |
| `MERCADOPAGO_ACCESS_TOKEN` | token do Mercado Pago (teste ou produção) |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | chave pública (troca de cartão) |
| `FOOTBALL_API_KEY` | chave da API-Football |
| `ADMIN_EMAILS` | e-mails com acesso ao `/admin`, separados por vírgula |
| `NEXT_PUBLIC_FREE_ACCESS_EMAILS` | e-mails com Passport liberado sem pagar |
| `NEXT_PUBLIC_SITE_URL` | URL do site (ex.: `https://tripsz.vercel.app`) |

## Banco de dados

`supabase-schema.sql` cria só `trip_answers` e `orders` (versão inicial).
O código usa várias outras tabelas, que **não estão** nesse arquivo:
`subscriptions`, `attended_games`, `public_profiles`, `saved_games`,
`fixtures_calendar`, `team_home_venues`, `fixtures_cache`, `venues_cache`,
`fixtures_fetch_log`, `calendar_sync_log`, `newsletter_subscribers` e
`team_logos` (esta tem SQL em `supabase-team-logos.sql`), além dos buckets
`avatars` e `team-logos`. As tabelas antigas `leagues` e `fixtures` não são mais
usadas e podem ser apagadas.

> **Pendência:** exportar o schema real do Supabase de produção e substituir
> `supabase-schema.sql`, para dar pra recriar o ambiente do zero.

## Rodando localmente

```bash
npm install
# crie .env.local com as variáveis acima
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

- Schema do banco desatualizado (ver acima).
- `TripszApp.jsx` tem quase 7 mil linhas; dividir por tela facilitaria a manutenção.
- Não existe `.env.example` no repositório.
