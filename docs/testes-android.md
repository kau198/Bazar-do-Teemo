# Verificação do aplicativo e instalação

Data: 9 de novembro de 2026.

## APK 1.0.2

- Compilação, lint e cinco testes unitários aprovados.
- Cinco testes de interface aprovados no emulador Android 15 (Pixel 2): busca sem acentos, favoritos, sacola e persistência; catálogo publicado; cadastro e recuperação offline; categorias, tamanhos e limite de quantidade; login após recriação da tela e logout.
- Os testes de alteração de dados usam uma API controlada no emulador. O teste de primeira abertura consulta o catálogo real no Render.
- Execução: https://github.com/kau198/Bazar-do-Teemo/actions/runs/42685320910
- SHA256 do APK disponibilizado: `F673AEE74509CA8410115F9F5887CA26DE8EBC7A184F22FE91BB80ACCA05F2F6`.

## Site e API

- Home local verificada no Edge em larguras de 1440, 390 e 320 pixels, sem rolagem horizontal ou erros JavaScript.
- Botão de instalação visível na entrada da home, download binário do APK, detalhes de produto, sacola, alteração de quantidade e persistência após recarregar aprovados.
- API pública: catálogo com 21 produtos, 21 imagens acessíveis, categorias e busca aprovados.
- Cadastro, consulta de sessão, logout, login e novo logout aprovados na API real. Foi criada somente a conta técnica `qa-android-1794253135610@example.invalid`, sem dados pessoais; a sessão foi encerrada. As credenciais não são incluídas no repositório.
- Validação de cadastro inválido (400) e credenciais incorretas (401) aprovadas.
- Configuração de proxy HTTPS verificada com cookie Secure em teste isolado do Express.
- `npm run check` e `git diff --check` aprovados.

## Publicação e limites

O arquivo público fica em `frontend/downloads/baazar-do-teemo.apk`. A home aponta diretamente para `/downloads/baazar-do-teemo.apk`; não é necessário GitHub ou ZIP. Ao trocar o APK, atualizar também o hash neste documento.

Na última conferência, o Render ainda servia a home anterior. É necessário publicar o último commit da branch main e confirmar que a rota do APK retorna `application/vnd.android.package-archive`, não HTML. A publicação pública permanece pendente dessa atualização.

Não houve teste em aparelho físico ou em todas as versões de Android. APK de avaliação, assinado com chave de desenvolvimento: versões antigas podem exigir desinstalação antes da nova instalação. Checkout e pagamentos não estão implementados. Os testes aprovados não constituem garantia de ausência de todos os defeitos.
