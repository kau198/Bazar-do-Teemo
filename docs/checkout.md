# Checkout de demonstração — versão 1.1.0

O site e o aplicativo Android permitem finalizar uma compra simulada com destinatário, telefone, CEP, rua, número, complemento, bairro, cidade e estado. O resumo apresenta produtos, quantidades, tamanhos e total antes da confirmação.

O frete ilustrativo custa R$ 19,90, com gratuidade a partir de R$ 299,00. Não há integração de pagamento, cobrança ou entrega real. Use dados fictícios nos testes.

## Backend

As rotas exigem sessão autenticada:

- `POST /api/v1/orders/quote`: valida o endereço e calcula o pedido com os preços do banco.
- `POST /api/v1/orders`: confirma o pedido usando `Idempotency-Key` e `expectedTotalCents`.
- `GET /api/v1/orders/:id`: recupera o recibo somente para a conta que fez o pedido.

A tabela `orders` é criada na inicialização do backend atualizado e também pode ser criada por `npm run migrate`. Os itens e o endereço são armazenados como retratos do momento da compra. A repetição da mesma tentativa retorna o pedido existente.

## Verificação em 9 de novembro de 2026

- `npm test`: quatro testes aprovados, cobrindo cálculos em centavos, frete gratuito, validações, gravação, repetição de tentativa e acesso restrito. Banco isolado em memória com pg-mem; não utiliza dados de produção.
- `npm run test:checkout`: fluxo completo no navegador em 1440 e 390 pixels. Inclui falha de conexão após o servidor registrar o pedido, nova tentativa sem duplicação, atualização da sacola e recuperação do recibo ao recarregar.
- `npm run check`: verificações de sintaxe aprovadas.
- Android: compilação, lint, cinco testes unitários e seis testes de interface aprovados no emulador Android 15. O novo teste percorre sacola, login, endereço, revisão, confirmação e limpeza dos itens comprados.
- Execução Android: https://github.com/kau198/Bazar-do-Teemo/actions/runs/42695117862
- APK: `frontend/downloads/baazar-do-teemo.apk`, versão 1.1.0.
- SHA256: `C63C4BDDB2E71AA41445E46FD2DBA0B51616C3EC560735064DC40D5FC7425F2A`.

O navegador usa uma sessão de teste e o serviço real de pedidos com banco isolado. O teste Android usa respostas controladas para o checkout. Não foram criados pedidos na API pública nem realizados testes em aparelho físico.

## Publicação

Publicar a branch `main` no Render para disponibilizar a página `/checkout`, as rotas de pedidos e o novo APK. O aplicativo depende dessa atualização para confirmar as simulações. Na última conferência, o site público ainda não servia a página de checkout.

O APK é assinado para desenvolvimento. Se o Android recusar a atualização de uma versão anterior, será necessário desinstalá-la antes; isso remove os favoritos e a sacola locais.
