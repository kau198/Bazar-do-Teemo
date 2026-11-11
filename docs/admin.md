# Painel administrativo

O painel fica em `/admin`, no mesmo servidor Express da loja. Usa o login e a sessão já existentes; contas comuns não recebem permissão de administrador ao se cadastrar.

## Instalação e acesso

1. Faça o deploy da branch no servidor que já hospeda o Bazar do Teemo, mantendo as variáveis `DATABASE_URL` e `SESSION_SECRET` existentes.
2. Execute `npm run migrate`. A inicialização do servidor também aplica a migração aditiva `003_admin` após garantir a tabela de pedidos. Em produção, prefira rodar as migrações antes de iniciar as novas instâncias.
3. Cadastre a conta desejada na loja, caso ainda não exista.
4. No terminal do servidor, usando o mesmo banco da aplicação, execute:

   ```bash
   npm run admin -- seu-email@exemplo.com
   ```

5. Entre em `/admin` com essa conta. O menu da conta da loja também mostra um link para o painel aos administradores.

Para remover o acesso, execute `npm run admin -- seu-email@exemplo.com revoke`. A API consulta a permissão no banco a cada requisição, inclusive para sessões já abertas. Não há senha padrão, autoatribuição de administrador nem endpoint público para promover contas.

## Funcionalidades

- Visão geral com quantidade de pedidos, valor total simulado sem cancelamentos, produtos ativos e alertas de estoque baixo (até cinco unidades).
- Cadastro e edição de nome, descrição, categoria, preço em reais, imagem, tamanhos, etiqueta e coleção.
- Seleção das imagens existentes na pasta `frontend/assets/images/products/`; esta versão não inclui envio de arquivos pelo navegador. Novas imagens precisam ser adicionadas ao projeto antes de serem usadas.
- Estoque inteiro ou ilimitado (campo vazio). Produtos existentes permanecem com estoque ilimitado até que o administrador informe uma quantidade.
- Ocultação de produtos no catálogo, preservando o registro e os itens de pedidos anteriores. Não há exclusão física.
- Busca, filtros por categoria/situação e exportação dos produtos filtrados em CSV.
- Consulta aos últimos 500 pedidos com cliente, itens, endereço, frete e total.
- Etapas dos pedidos: confirmado → em preparação → enviado → concluído. Confirmação e preparação também permitem cancelar. Todas as etapas são demonstrativas; nenhuma mudança efetua cobrança ou envio real.

## Estoque e preços

O checkout recalcula preços no servidor e recusa a confirmação se o total revisado estiver desatualizado. Produtos ocultos não podem ser comprados. Quantidades do mesmo produto em tamanhos diferentes são somadas para verificar o estoque, que é compartilhado entre os tamanhos nesta versão.

Ao confirmar um pedido, o PostgreSQL bloqueia os produtos em ordem de ID e decrementa o estoque dentro da transação. Reenvios da mesma tentativa não decrementam novamente. Cada item registra se consumiu estoque controlado. O cancelamento bloqueia o pedido e devolve apenas essas unidades, uma vez; pedidos antigos que não registravam estoque não geram reposição. Pedidos cancelados e concluídos não podem ser reabertos.

Os preços, nomes e totais já registrados em pedidos permanecem como estavam na compra. O valor do painel é referente a pedidos de demonstração, não a receitas financeiras reais.

## Segurança

Todas as rotas `/api/v1/admin` exigem sessão e função `admin` no banco. As escritas também exigem o token CSRF da sessão, obtido em `GET /api/v1/admin/session`. Respostas administrativas usam `Cache-Control: no-store`; o service worker deixa as APIs e o painel fora da estratégia offline. Texto dinâmico é escapado na interface e entradas são validadas no servidor. Imagens administrativas são limitadas aos caminhos de imagens locais, conforme a CSP existente.

## Verificação

```bash
npm run check
npm test
```

Os testes cobrem validação de produtos, cadastro/edição persistentes, verificação de acesso, token CSRF, revogação em sessão aberta, baixa e reposição de estoque, idempotência, estoque somado entre tamanhos, produtos ocultos, preços desatualizados e os fluxos de pedidos existentes. São executados em banco isolado com `pg-mem`; não substituem um teste de concorrência em PostgreSQL real.

Nesta implementação não foi executado teste visual no navegador: o ambiente não disponibilizou `cua_repl.js`. A publicação no Render e a ativação da conta administrativa precisam ser realizadas no ambiente que possui o banco de produção.
