<p align="center">
  <img src="./frontend/assets/icons/logo-teemo-transparent.png" alt="Logo do Bazar do Teemo" width="210">
</p>

<h1 align="center">Bazar do Teemo</h1>

<p align="center">
  Uma loja virtual inspirada em League of Legends, com site responsivo e aplicativo Android nativo.
</p>

<p align="center">
  <a href="https://bazar-do-teemo.onrender.com">Visitar o site</a> ·
  <a href="./frontend/downloads/baazar-do-teemo.apk">APK de avaliação</a> ·
  <a href="./mobile/README.md">Documentação Android</a>
</p>

## Propósito

O Bazar do Teemo é um projeto acadêmico que simula uma loja de produtos inspirados em League of Legends. A ideia é praticar o desenvolvimento de uma aplicação completa, do catálogo e da autenticação até o registro de um pedido, com dois clientes usando a mesma API.

## O que dá para fazer

- Navegar pelo catálogo, buscar produtos e filtrar por categoria.
- Consultar detalhes, escolher tamanho e quantidade, salvar favoritos e montar a sacola.
- Criar uma conta, entrar e finalizar um **pedido de demonstração** com endereço fictício.
- No Android, consultar o catálogo salvo mesmo sem conexão. As operações de conta e a confirmação do pedido exigem acesso à API.

O checkout calcula os preços no servidor, exibe o frete antes da confirmação e evita pedidos duplicados quando a mesma tentativa é reenviada. O frete simulado custa R$ 19,90 e é gratuito a partir de R$ 299,00. Os preços são fictícios e o fluxo termina no registro do pedido, sem cobrança ou entrega.

## Como o site e o app se conectam

O Express serve as páginas do site e disponibiliza a API REST em `/api/v1`. O site e o aplicativo enviam requisições a essa API para consultar o catálogo, autenticar usuários e registrar pedidos. O PostgreSQL armazena usuários, produtos, sessões e pedidos.

A interface Android foi implementada em **Java com telas nativas**. O que o app reaproveita do site é a API. O **Gradle Wrapper** fixa a versão do Gradle em 8.11.1, e o Gradle executa os testes, a análise com lint e a geração do APK.

| Parte | Tecnologias |
| --- | --- |
| Site | HTML, CSS e JavaScript, com manifesto PWA e service worker |
| API | Node.js 20+, Express 5 |
| Banco de dados | PostgreSQL no Neon |
| Autenticação | Sessões no PostgreSQL, cookies de sessão e senhas com hash via bcryptjs |
| Aplicativo | Java 17, Android SDK 35 e Gradle 8.11.1 |
| Testes | Node.js Test Runner, pg-mem, Playwright e testes Android |

## Rodar o site localmente

Pré-requisitos: Node.js 20+, npm e um banco PostgreSQL. O projeto usa o [Neon](https://console.neon.tech) como serviço de banco de dados.

```bash
git clone https://github.com/kau198/Bazar-do-Teemo.git
cd Bazar-do-Teemo
npm ci
cp .env.example .env
```

Preencha `DATABASE_URL` com a string de conexão do banco e `SESSION_SECRET` com um valor aleatório para assinar as sessões. Você pode gerar esse valor com `node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"`. Para execução local, mantenha `NODE_ENV=development` e `PORT=3000`.

```bash
npm run migrate  # Cria as tabelas
npm run seed     # Importa os produtos de demonstração
npm run dev      # Inicia o servidor
```

Abra [http://localhost:3000](http://localhost:3000).

## Instalar ou compilar o app Android

O APK de avaliação é compatível com **Android 8.0 (API 26) ou superior**. O app usa o endereço do site no Render por padrão. Para testar com o backend local, abra **Servidor** no app e informe `http://IP-DO-COMPUTADOR:3000`, com o computador e o celular na mesma rede. Para finalizar pedidos pelo app, o servidor precisa oferecer as rotas de checkout.

Para compilar, instale o JDK 17 e o Android SDK 35, abra a pasta `mobile/` no Android Studio e rode:

```bash
cd mobile
./gradlew testDebugUnitTest lintDebug assembleDebug
```

No Windows, use `gradlew.bat` no lugar de `./gradlew`. O APK de desenvolvimento é gerado em `mobile/app/build/outputs/apk/debug/app-debug.apk`. O [workflow Android APK](https://github.com/kau198/Bazar-do-Teemo/actions) também gera uma versão de avaliação.

## API REST

Prefixo das rotas: `/api/v1`.

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/products` | Lista produtos |
| GET | `/products/search?q=termo` | Busca no catálogo |
| GET | `/products/:id` | Consulta um produto |
| GET | `/categories` | Lista categorias |
| GET | `/auth/me` | Consulta a sessão atual |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Cadastro, login e logout |
| POST | `/orders/quote` | Calcula o resumo do pedido |
| POST | `/orders` | Confirma o pedido simulado |
| GET | `/orders/:id` | Recupera o recibo do usuário autenticado |

A confirmação recebe o cabeçalho `Idempotency-Key` e o total revisado em `expectedTotalCents`. Consulte a [documentação do checkout](./docs/checkout.md) para detalhes e resultados dos testes.

## Organização e testes

| Pasta | Conteúdo |
| --- | --- |
| [`frontend/`](./frontend/) | Páginas, estilos, JavaScript e recursos visuais |
| [`backend/`](./backend/) | Servidor, rotas, serviços e migrações do banco |
| [`mobile/`](./mobile/) | Código Android e configuração do Gradle |
| [`data/`](./data/) | Produtos de demonstração usados pelo seed |
| [`docs/`](./docs/) | Referências e registros de testes |

```bash
npm run check           # Verificação de sintaxe JavaScript
npm test                # Testes de pedidos em banco isolado
npm run test:checkout   # Fluxo do checkout no navegador com Playwright
```

## Créditos

Projeto acadêmico independente, sem vínculo com a Riot Games. As referências dos produtos e das imagens estão em [`docs/product-sources.json`](./docs/product-sources.json).
