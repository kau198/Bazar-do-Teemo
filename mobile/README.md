# Aplicativo Android

Cliente nativo em Java, com telas Android. Não usa WebView e não depende da instalação da PWA.

## Funcionalidades
- Catálogo, busca sem acentos, categorias e ordenação.
- Detalhes, tamanho e quantidade.
- Favoritos e sacola persistidos por servidor no aparelho.
- Login e cadastro usando as rotas existentes da API.
- Catálogo salvo para consulta offline, com aviso de desatualização.
- Configuração do endereço da loja.

## Conectar
O aplicativo abre conectado a https://bazar-do-teemo.onrender.com. Não é necessário configurar um endereço na primeira abertura. Um servidor escolhido anteriormente é preservado; para alterá-lo, toque em **Servidor** e informe a origem do site, sem /api/v1.

Para uma API publicada: https://sua-loja.com.
Para testes locais: http://IP-DO-COMPUTADOR:3000, com celular e computador na mesma rede e a porta liberada no firewall. Localhost no aparelho não é o computador. Nunca informe credenciais do Neon no aplicativo.

O catálogo consulta GET /api/v1/products. Conta usa /api/v1/auth/me, /login, /register e /logout. Senhas não são persistidas; cookies da sessão permanecem em memória durante a execução do processo.

## Gerar APK
No GitHub, abra Actions → Android APK. A compilação roda para alterações em mobile/ na main e também pode ser iniciada por Run workflow.

Ao terminar, baixe o artefato baazar-do-teemo-apk, extraia o ZIP e instale app-debug.apk. É uma versão de testes, assinada com chave de desenvolvimento, não uma publicação na Play Store. Builds de ambientes diferentes podem exigir desinstalar a versão anterior, apagando os dados locais.

Para compilar localmente, abra esta pasta no Android Studio e use Gradle 8.11.1, JDK 17 e Android SDK 35:
    ./gradlew testDebugUnitTest lintDebug assembleDebug

No Windows: .\gradlew.bat testDebugUnitTest lintDebug assembleDebug

Saída: app/build/outputs/apk/debug/app-debug.apk.
Android mínimo: 8.0 (API 26).

## Limites
Checkout, frete, pedidos, edição de perfil e tradução PT/EN não fazem parte desta versão. O modo offline não permite login nem cadastro. O APK debug permite HTTP para testar na rede local; release exige HTTPS e uma chave de assinatura própria.
