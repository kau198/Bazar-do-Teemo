# Escopo — Bazar do Teemo

Referência: Atividades EX1 a EX9, Fatec Americana, 2026. O documento é material de requisitos; esta etapa implementa somente o frontend do site. A calculadora (EX8) é um projeto separado.

| Exercício | Entrega prevista                                                                                                    | Estado                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EX1       | Início, catálogo e contato; navegação comum; menu móvel; layout responsivo                                          | Implementado; navegador conferido em desktop (1440px) e celular (390px) |
| EX2       | Arquivos PT/EN, seletor persistente, formatos regionais, mensagens traduzidas                                       | Pendente                                                                |
| EX3       | Cadastros de produtos e clientes, seis campos ou mais, validação, pesquisa, paginação, edição e exclusão confirmada | Pendente; dados atuais são demonstrativos                               |
| EX4       | API REST autenticada, JSON, CORS e documentação                                                                     | Etapa de backend                                                        |
| EX5       | Internacionalização nativa do aplicativo                                                                            | Etapa do aplicativo                                                     |
| EX6       | Site consumindo a API; autenticação, carregamento e erros                                                           | Depois do backend                                                       |
| EX7       | Aplicativo com login, listagem, detalhe e cadastro                                                                  | Etapa do aplicativo; PWA não substitui essa entrega                     |
| EX9       | ERP: cadastros, pedidos, estoque, financeiro, perfis e logs                                                         | Etapa posterior                                                         |

## Direção visual

Loja com verde profundo, fundos claros, tipografia Manrope/DM Sans e fotografias reais de 21 produtos da Riot Games Merch. Temas claro e escuro. Animações curtas e respeito à preferência por movimento reduzido. Logo PNG com fundo transparente incorporada no cabeçalho e no rodapé das três páginas.

## Arquitetura prevista

O site e o aplicativo serão clientes separados de uma API comum. Dados locais atuais servem apenas ao protótipo. A API concentrará validação, autenticação, regras e persistência relacional. O ERP terá interface própria e acesso controlado por perfil. Nenhum pagamento, envio de mensagem ou autenticação real está implementado.
