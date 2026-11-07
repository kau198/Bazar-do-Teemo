# Integração futura da API

Esta etapa usa uma fonte local de demonstração, não uma API ou banco reais.

## Separação atual

- data/products.json: catálogo de demonstração com IDs estáveis.
- services/catalog.js: busca assíncrona e validação básica da resposta.
- app.js: interface, filtros e sacola local.
- docs/product-sources.json: origem das fotos e dos produtos.

Para integrar o catálogo, adaptar listProducts() em services/catalog.js. A interface hoje espera a lista completa; se a API tiver paginação, o serviço e a navegação precisarão ser adaptados juntos.

## Contrato proposto

GET /api/v1/products retorna { items: Product[], total: number }.
GET /api/v1/products/:id retorna Product.

Product: id (inteiro estável), name, description, category, price (valor demonstrativo em reais), currency (BRL), imageUrl, sourceUrl, sizes (lista), tag e art (slug legado da imagem).
Preservar os IDs mantém referências dos favoritos e da sacola.

## Etapas posteriores

1. Modelar produtos, variantes/tamanhos, clientes, pedidos e estoque no banco relacional.
2. Criar API própria com autenticação e autorização para os cadastros.
3. Adicionar paginação, busca, validação e respostas de erro documentadas.
4. Conectar site e aplicativo à mesma API.
5. Criar pedidos no servidor, recalculando preços, estoque e totais. Nunca confiar no subtotal ou preço enviado pelo navegador.

As imagens da Riot Merch são referências para estudo. A Riot API/Data Dragon pode complementar informações de campeões; não substitui a API comercial própria.
