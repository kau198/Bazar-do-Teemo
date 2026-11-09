# Baazar do Teemo

Loja virtual de produtos do universo de League of Legends, com separação clara entre front-end e back-end, PostgreSQL 18 (Neon), API REST e autenticação completa.

---

## Visão geral da arquitetura

```
bazar-do-teemo/
│
├── frontend/                   # Tudo que roda no navegador
│   ├── assets/
│   │   ├── icons/              # Logo e ícones (logo-teemo-transparent.png, icon.svg)
│   │   └── images/products/    # Imagens dos 21 produtos
│   ├── css/
│   │   └── style.css           # Estilos globais + componentes + responsividade
│   ├── js/
│   │   ├── main.js             # Lógica da loja (catálogo, sacola, favoritos)
│   │   ├── services/
│   │   │   └── catalog.js      # Chamadas à API de produtos
│   │   └── auth/
│   │       ├── auth.js         # Chamadas à API de autenticação
│   │       └── auth-ui.js      # Controlador do modal de login/cadastro
│   ├── pages/
│   │   ├── index.html          # Página inicial
│   │   ├── catalogo.html       # Catálogo completo
│   │   └── contato.html        # Página de contato
│   ├── manifest.webmanifest    # PWA manifest
│   └── sw.js                   # Service Worker (cache offline)
│
├── backend/                    # Servidor Node.js/Express
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js     # Pool PostgreSQL (Neon)
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── productController.js
│   │   ├── middlewares/
│   │   │   ├── errorHandler.js
│   │   │   └── requireAuth.js
│   │   ├── routes/
│   │   │   ├── auth.js         # /api/v1/auth/*
│   │   │   └── products.js     # /api/v1/products, /api/v1/categories
│   │   ├── services/
│   │   │   ├── authService.js  # Registro, login, bcrypt
│   │   │   └── productService.js
│   │   └── utils/
│   │       └── errors.js       # Classes AppError, NotFoundError, etc.
│   ├── database/
│   │   └── migrations/
│   │       ├── 001_initial.js  # DDL: users, products, sessions
│   │       ├── migrate.js      # Runner de migrations
│   │       └── seed.js         # Importa produtos do JSON
│   └── index.js                # Entrada do servidor Express
│
├── data/
│   └── products.json           # Fonte dos 21 produtos (usado apenas pelo seed)
│
├── .env.example                # Template de variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | HTML5, CSS3, JavaScript (ES Modules) |
| Back-end | Node.js 20+, Express 5 |
| Banco de dados | PostgreSQL 18 via Neon |
| Autenticação | express-session + connect-pg-simple |
| Senhas | bcryptjs (12 rounds) |
| Segurança | helmet, express-rate-limit, cookies HttpOnly |
| Validação | express-validator |

---

## Instalação

```sh
# Requer Node.js 20+
npm install
```

---

## Configuração das variáveis de ambiente

```sh
cp .env.example .env
```

Edite `.env`:

```env
DATABASE_URL=postgres://usuario:senha@ep-xxxx.neon.tech/bazardoteemo?sslmode=require
SESSION_SECRET=um_segredo_forte_e_aleatorio
NODE_ENV=development
PORT=3000
```

Como obter a `DATABASE_URL`:
1. Acesse [console.neon.tech](https://console.neon.tech)
2. Crie um projeto e um banco de dados
3. Em **Connection Details → Connection string**, copie o valor

Como gerar um `SESSION_SECRET` seguro:
```sh
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Execução das migrations

```sh
npm run migrate
```

Cria as tabelas `users`, `products` e `sessions`. Idempotente.

---

## Importação dos produtos

```sh
npm run seed
```

Importa os 21 produtos de `data/products.json` para o PostgreSQL. Idempotente.

---

## Como iniciar

```sh
cp .env.example .env   # configurar variáveis
npm run migrate        # criar tabelas
npm run seed           # importar produtos
npm run dev            # iniciar em http://localhost:3000
```

---

## Endpoints da API

### Produtos
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/v1/products` | Lista todos os produtos |
| GET | `/api/v1/products/search?q=termo` | Pesquisa por nome/descrição/categoria |
| GET | `/api/v1/products/:id` | Retorna produto por ID |
| GET | `/api/v1/categories` | Lista categorias |

Parâmetros opcionais: `category`, `sort` (`featured`, `low`, `high`, `new`)

### Autenticação
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/v1/auth/me` | Sessão ativa |
| POST | `/api/v1/auth/register` | Cadastro |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |

---

## Como executar os testes

```sh
npm run check    # verificação de sintaxe de todos os arquivos JS
```

Testes funcionais manuais:
- Acesse http://localhost:3000 e navegue pelo catálogo
- Use a barra de pesquisa (resultados vêm do banco via `/api/v1/products/search`)
- Clique em **Entrar** para cadastrar uma conta e fazer login
- Clique no seu nome para fazer logout

---

## Segurança

- Senhas: bcrypt 12 rounds — nunca armazenadas em texto puro
- Cookies: `HttpOnly`, `Secure` (produção), `SameSite: strict` (produção)
- Rate limiting: 300 req/15min global; 20 req/15min para rotas de auth
- Bloqueio por IP após 10 tentativas de login falhas
- Queries 100% parametrizadas (sem SQL Injection)
- Headers de segurança via helmet
- `SESSION_SECRET` e `DATABASE_URL` apenas em variável de ambiente

---

## Créditos

Projeto acadêmico independente, sem afiliação à Riot Games. Produtos e fotografias usados como referência estão documentados em [docs/product-sources.json](docs/product-sources.json). Os preços são fictícios.

## Aplicativo Android

Aplicativo nativo para Android 8.0 ou superior, conectado à mesma API do site. Inclui catálogo, busca, categorias, favoritos, sacola, cadastro e login.

Na home, o botão **Instalar app Android** baixa o APK diretamente. As instruções ficam em `/aplicativo`, e o arquivo está em `frontend/downloads/baazar-do-teemo.apk`.

- [Código e instruções de compilação](mobile/README.md)
- [Resultados dos testes da versão 1.0.2](docs/testes-android.md)

O APK é uma versão de avaliação. Pagamentos, frete e envio de pedidos ainda não estão disponíveis.
