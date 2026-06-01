# Chute Certo — Guia de Setup e Deploy

Bolão da Copa com resultado automático via API-Football, autenticação via Supabase e deploy na Vercel.

---

## Pré-requisitos

- Node.js 18+ instalado
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita na [Vercel](https://vercel.com)
- Conta no [RapidAPI](https://rapidapi.com) para a API-Football
- Git instalado

---

## 1. Supabase — banco de dados

1. Acesse [supabase.com](https://supabase.com) e crie um projeto novo
2. Espere o projeto iniciar (~2 minutos)
3. Vá em **SQL Editor** > **New Query**
4. Cole o conteúdo do arquivo `supabase/migrations/001_schema.sql` e clique em **Run**
5. Vá em **Settings** > **API** e copie:
   - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → será `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha este!)

---

## 2. API-Football

1. Acesse [rapidapi.com/api-sports/api/api-football](https://rapidapi.com/api-sports/api/api-football)
2. Crie uma conta e assine o plano **Free** (100 req/dia)
3. Copie sua **X-RapidAPI-Key** → será `API_FOOTBALL_KEY`

> **Nota:** O plano free tem 100 chamadas/dia. O cron roda a cada 5 minutos,
> o que dá até 288 chamadas/dia para 1 jogo. Se houver múltiplos jogos
> simultâneos, ajuste o intervalo do cron em `vercel.json` para `*/10` ou `*/15`.
> Para a Copa (jogos em horários separados) o plano free é suficiente.

---

## 3. Configurar variáveis de ambiente localmente

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com os valores copiados acima. Para `CRON_SECRET`, gere uma string aleatória longa, ex:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Instalar e rodar localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## 5. Deploy na Vercel

### 5a. Suba o projeto para o GitHub

```bash
git init
git add .
git commit -m "chute certo inicial"
gh repo create chute-certo --public --push
# ou crie o repo no github.com e siga as instruções
```

### 5b. Conecte à Vercel

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório `chute-certo`
3. Na tela de configuração, clique em **Environment Variables** e adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do Supabase |
| `API_FOOTBALL_KEY` | Sua chave da API-Football |
| `CRON_SECRET` | O segredo gerado no passo 3 |

4. Clique em **Deploy**

### 5c. Atualizar o vercel.json com o CRON_SECRET

Após o deploy, edite `vercel.json` e substitua `SUBSTITUA_PELO_SEU_CRON_SECRET` pelo valor real que você gerou:

```json
{
  "crons": [
    {
      "path": "/api/cron/results?secret=SEU_VALOR_AQUI",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Faça commit e push para redeploy automático.

---

## 6. IDs dos jogos na API-Football

Antes da Copa começar, você precisa atualizar os `api_id` na tabela `matches` com os IDs reais da API-Football.

Para encontrá-los, faça uma chamada de teste no RapidAPI:
```
GET /fixtures?league=1&season=2026
```

Depois atualize via SQL Editor no Supabase:
```sql
UPDATE matches SET api_id = 123456 WHERE home_name = 'Brasil' AND away_name = 'Argentina';
-- repita para cada jogo
```

---

## 7. Como funciona o cron automático

A Vercel chama `/api/cron/results?secret=...` a cada 5 minutos.
O endpoint busca todos os jogos que já começaram e ainda não têm resultado,
consulta a API-Football, e atualiza `result_home`, `result_away` e `status` no banco.

Os pontos são calculados automaticamente pela view `scoreboard` no Supabase.

---

## Estrutura do projeto

```
chute-certo/
├── src/
│   ├── app/
│   │   ├── (app)/           # Páginas autenticadas
│   │   │   ├── apostas/     # Lista de jogos + apostas
│   │   │   ├── placar/      # Scoreboard do grupo
│   │   │   ├── grupo/       # Criar/entrar em grupo
│   │   │   └── perfil/      # Perfil + stats pessoais
│   │   ├── api/
│   │   │   └── cron/results/ # Cron job de resultados
│   │   └── login/           # Login/registro
│   ├── components/
│   │   └── BottomNav.tsx
│   ├── lib/
│   │   ├── supabase-browser.ts
│   │   └── supabase-server.ts
│   ├── types/index.ts
│   └── middleware.ts
├── supabase/
│   └── migrations/001_schema.sql
├── vercel.json              # Config do cron
└── .env.local.example
```

---

## Problemas comuns

**"relation profiles does not exist"** → Execute o SQL do passo 1 novamente

**"Invalid API key"** na API-Football → Verifique a variável `API_FOOTBALL_KEY` na Vercel

**Cron não roda** → Verifique se o `CRON_SECRET` no `vercel.json` bate com o da variável de ambiente

**Apostas não salvam** → Verifique se o usuário está em um grupo e se o jogo ainda não começou
