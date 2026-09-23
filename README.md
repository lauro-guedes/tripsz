# tripsz — checklist pra colocar no ar

Este projeto já está com o código pronto: login, banco de dados e pagamento
de verdade. Só falta você criar as contas (isso exige seu e-mail/identidade,
por isso só você pode fazer) e colar as chaves nos lugares certos.

## O que já está pronto no código
- Login com Google e criação de conta (via Supabase Auth)
- Banco de dados com as tabelas de respostas e pedidos (`supabase-schema.sql`)
- Checkout que cria uma cobrança real no Mercado Pago
- Webhook que confirma o pagamento e libera o roteiro
- Todas as 10 telas do fluxo, com o motor de cruzamento de jogos

## O que falta você fazer (nessa ordem)

### 1. Criar conta no GitHub (se ainda não tiver)
Suba esta pasta como um repositório novo. Se não souber como, me avise —
consigo te dar o passo a passo exato pro seu computador.

### 2. Criar conta no Supabase (supabase.com)
1. Crie um projeto novo (escolha a região São Paulo, se disponível)
2. Vá em **SQL Editor** → cole o conteúdo de `supabase-schema.sql` → Run
3. Vá em **Settings → API** e copie:
   - `Project URL` → cole em `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → cole em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → cole em `SUPABASE_SERVICE_ROLE_KEY`
4. Vá em **Authentication → Providers → Google** e ative — vai pedir um
   Client ID/Secret do Google (veja passo 3)

### 3. Criar credenciais do Google (console.cloud.google.com)
1. Crie um projeto novo
2. Vá em **APIs & Services → Credentials → Create OAuth Client ID**
3. Tipo: "Web application"
4. Em "Authorized redirect URIs", cole a URL que o Supabase mostrou na
   tela do passo 2.4 (algo como `https://xxxx.supabase.co/auth/v1/callback`)
5. Copie o Client ID e Client Secret e cole na tela do Supabase (passo 2.4)

### 4. Criar conta no Mercado Pago (mercadopago.com.br/developers)
1. Crie a conta (vai pedir CPF/CNPJ — é assim que eles verificam quem
   está recebendo o dinheiro, não tem como pular essa parte)
2. Vá em **Suas integrações → Credenciais de teste** primeiro (pra testar
   sem cobrar ninguém de verdade)
3. Copie o **Access Token** → cole em `MERCADOPAGO_ACCESS_TOKEN`
4. Quando estiver pronto pra cobrar de verdade, troque pelas
   **Credenciais de produção**

### 5. Criar conta na Vercel (vercel.com) e publicar
1. Conecte sua conta do GitHub
2. Importe este repositório
3. Em **Settings → Environment Variables**, cole todas as variáveis do
   `.env.example` com os valores reais que você coletou acima
4. Clique em Deploy — a Vercel te dá um link tipo `tripsz.vercel.app`
5. Volte no Mercado Pago e Supabase e atualize as URLs de retorno/callback
   trocando `localhost:3000` pelo link real da Vercel

## O que ainda não está ligado (próximo passo depois de testar)
- Depois que alguém paga e volta do Mercado Pago, a tela de resultado hoje
  recalcula o roteiro do zero em vez de carregar o que foi salvo no banco —
  funciona pro teste, mas o ideal é buscar o registro salvo em `trip_answers`
  pelo `tripAnswersId`. Me avisa quando quiser que eu feche essa parte.
- Dados de jogos ainda são um exemplo fixo (não vêm de uma API de verdade)
- Domínio próprio (pode continuar no link gratuito da Vercel por enquanto)

## Rodando localmente (opcional, se quiser ver antes de publicar)
```bash
npm install
cp .env.example .env.local   # e preencha com os valores reais
npm run dev
```
Abre em http://localhost:3000
