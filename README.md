# Baazar do Teemo

Loja de produtos de League of Legends desenvolvida para o projeto de Aplicações Web. O catálogo tem 21 itens em seis categorias, com preços de demonstração.

## Rodar localmente

Requer Node.js 20 ou superior. Não é necessário instalar dependências.

```sh
npm run dev
```

Acesse http://localhost:3000.

Também é possível usar o Live Server do VS Code: clique com o botão direito em index.html e escolha **Open with Live Server**. Os caminhos são relativos à pasta do projeto, incluindo quando ela está dentro de outra pasta do workspace. Abra por HTTP; abrir o HTML diretamente como arquivo não permite carregar os módulos e o catálogo.

## Funcionalidades

- Catálogo com busca, categorias, filtro de preço e ordenação.
- Favoritos, histórico de produtos vistos e sacola salvos no navegador.
- Seleção de tamanho e quantidade, subtotal e links dos produtos.
- Layout responsivo, temas claro e escuro e suporte a PWA.
- Páginas de início, catálogo e contato.

## Estrutura

- `app.js`: interação da loja.
- `style.css`: estilos e adaptação para celular.
- `data/products.json`: catálogo local.
- `services/catalog.js`: carregamento dos produtos.
- `public/`: logo e imagens.
- `server.mjs`: servidor de desenvolvimento.
- `sw.js`: cache para acesso offline.

## Próximas etapas

A API própria será compartilhada pelo site e pelo aplicativo. Ela concentrará produtos, clientes, pedidos e estoque. O planejamento está em [docs/api-planejada.md](docs/api-planejada.md), e as entregas do trabalho estão em [docs/escopo.md](docs/escopo.md).

Ainda não há autenticação, pagamento, cálculo de frete ou envio de mensagens. O catálogo usa dados locais; a PWA não substitui o aplicativo nativo previsto no trabalho.

## Verificação

```sh
npm run check
```

O comando verifica a sintaxe dos arquivos JavaScript. Busca, filtros, quantidades, sacola e layout responsivo também foram conferidos no navegador.

## Créditos

Projeto acadêmico independente, sem afiliação à Riot Games. Produtos e fotografias usados como referência estão documentados em [docs/product-sources.json](docs/product-sources.json). Os preços são fictícios.

Foi utilizada assistência de IA na implementação do front-end e no tratamento da logo.
