## Roleplay AI — site de criação de histórias fictícias

App estilo mensageiro, dark mode, onde o usuário cria personagens próprios e desenvolve histórias imersivas conversando com uma IA que mantém personalidade consistente.

### Aviso sobre conteúdo
O app terá um **gate de idade 18+** na primeira visita e tom narrativo maduro (drama, romance, conflito, temas adultos). Importante deixar claro: a IA usa Lovable AI (Gemini/GPT) com filtros de segurança nativos do provedor que **não podem ser desligados** — então conteúdo sexual explícito ou ilegal será bloqueado pelo modelo. Dentro disso, o prompt do sistema vai pedir liberdade narrativa máxima para roleplay criativo.

### Páginas

```
/                       Landing + gate 18+ → CTA login
/auth                   Login/cadastro (email + Google)
/app                    Layout autenticado (sidebar de histórias)
  /app                  Home: meus personagens + continuar histórias
  /app/characters/new   Criar personagem
  /app/characters/:id   Detalhe + iniciar nova história
  /app/chat/:storyId    Tela de chat (core)
  /app/library          Biblioteca de histórias salvas
  /app/settings         Conta, logout
```

### Sistema de personagens

Formulário de criação:
- Nome, categoria (romance, fantasia, ação, mistério, sci-fi, slice-of-life, terror)
- Personalidade (tags + descrição livre)
- Estilo de fala (formal, casual, poético, sarcástico, etc.)
- História de fundo (textarea)
- Cena/cenário inicial
- Primeira mensagem do personagem (greeting)
- **Avatar**: três opções
  1. Gerar com IA (Gemini image, baseado em nome+descrição)
  2. Upload de imagem (Lovable Cloud Storage)
  3. Iniciais coloridas (fallback automático)

### Tela de chat (core)

- Layout mensageiro centralizado, bolhas estilo iMessage dark
- Header com avatar + nome do personagem + menu (editar narrativa, reiniciar, favoritar, excluir)
- Mensagens renderizadas com markdown e *itálico para ações*
- Indicador de digitação animado enquanto IA gera
- **Streaming token-por-token** via server function (resposta aparece progressivamente)
- Delay realista de 400-800ms antes de começar a resposta
- Sugestões de resposta abaixo do input (3 opções geradas pela IA: continuar, agir, perguntar)
- Botões: enviar, regenerar última, editar mensagem, apagar daqui pra baixo
- Toast de erro para 429 (rate limit) e 402 (créditos)

### Memória e narrativa

- Histórico completo da conversa enviado ao modelo a cada turno
- Quando passa de ~30 mensagens, resumo automático das mensagens mais antigas em background para preservar contexto sem estourar tokens
- Prompt de sistema injeta: persona do personagem, cenário, instruções de roleplay (manter personagem, descrever ações em itálico, narrativa em terceira pessoa quando aplicável, evoluir a história)

### Biblioteca de histórias

- Cards com avatar do personagem, título auto-gerado, última mensagem, data
- Filtros: favoritas, por personagem, por categoria
- Busca por texto
- Ações: continuar, renomear, favoritar, exportar (.txt), excluir

### Login e dados
- Email/senha + Google via Lovable Cloud
- Confirmação de email desativada para fluxo rápido
- Gate 18+ exigido antes de criar conta (flag salva no perfil)

### Visual
- Dark mode permanente, fundo quase preto com gradientes sutis púrpura/índigo
- Tipografia: Inter para UI, serifa elegante para nomes de personagens
- Avatares circulares com glow sutil
- Animações suaves (framer-motion) em transições de tela e bolhas de mensagem
- Mobile-first, mas funciona bem em desktop com layout de duas colunas (lista + chat)

---

### Detalhes técnicos

**Stack:** TanStack Start + Lovable Cloud (Supabase) + Lovable AI Gateway.

**Modelo de IA:**
- Chat: `google/gemini-3-flash-preview` (rápido, criativo, bom para diálogo). Opção futura de trocar para `gemini-2.5-pro` em personagens "premium".
- Sugestões de resposta: mesmo modelo, chamada paralela com tool-calling estruturado.
- Geração de avatar: `google/gemini-2.5-flash-image` (Nano Banana).

**Server functions** (`createServerFn` com `requireSupabaseAuth`):
- `streamChat` — server route SSE em `/api/chat` (precisa streaming, server function não suporta SSE nativo)
- `generateSuggestions` — retorna 3 respostas curtas
- `generateAvatar` — gera imagem, sobe pra storage, retorna URL
- `summarizeOldMessages` — compacta contexto antigo
- `generateStoryTitle` — após 4 mensagens, gera título da história

**Banco (Lovable Cloud):**
- `profiles` (id, display_name, age_confirmed_at)
- `characters` (id, user_id, name, category, personality, speech_style, backstory, scenario, greeting, avatar_url, is_public, created_at)
- `stories` (id, user_id, character_id, title, is_favorite, last_message_at, summary, created_at)
- `messages` (id, story_id, role, content, created_at)
- RLS: usuário só vê/edita próprios registros. Roles via tabela `user_roles` separada (preparada para futura moderação).
- Storage bucket `avatars` público, com policies de upload por owner.

**Streaming:** server route em `src/routes/api/chat.ts` que repassa o stream SSE do Lovable AI Gateway. Frontend faz parse line-by-line e atualiza a última mensagem do assistente progressivamente.

**Segurança:** sem service role no cliente; service role só em route handlers verificados. Validação Zod em todas as entradas. Rate limit visível (toast amigável em 429/402).

---

### Escopo desta primeira entrega

Tudo acima exceto:
- Exportar como .txt (deixo a estrutura, implemento depois se quiser)
- Personagens "premium" com modelo Pro
- Compartilhamento público de personagens

Esses ficam fáceis de adicionar depois.