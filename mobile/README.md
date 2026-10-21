# tripsz — app (iOS / Android)

O app é uma casca Capacitor que abre **https://www.tripsz.com.br** numa WebView. O código do produto é só o do site (raiz do repositório): cada deploy na Vercel aparece no app na hora. Esta pasta só guarda a configuração nativa e **não entra no build do site**.

O `www/index.html` é só uma tela reserva exigida pelo Capacitor; com `server.url` o app carrega o site.

## Primeira vez (no seu computador)
Requisitos: Node 18+; Android Studio (Android); Mac com Xcode (iOS).

```bash
cd mobile
npm install
npx cap add android      # cria mobile/android
npx cap add ios          # cria mobile/ios (só no Mac)
# ícone e splash: coloque mobile/assets/icon.png (1024x1024) e mobile/assets/splash.png (2732x2732)
npm run assets
npx cap sync
npx cap open android     # ou: npx cap open ios
```

## Ajustes nativos depois do `cap add`
- **Link de retorno do Google** (`br.com.tripsz.app://auth`):
  - Android: em `android/app/src/main/AndroidManifest.xml`, na `<activity>` principal, adicione
    `<intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="br.com.tripsz.app"/></intent-filter>`
  - iOS: em Xcode > Target > Info > URL Types, adicione o esquema `br.com.tripsz.app`.
- **Supabase** > Authentication > URL Configuration > Redirect URLs: adicione `br.com.tripsz.app://auth`.
- **Links universais** (opcional, links de tripsz.com.br abrindo o app): Android App Links (`assetlinks.json`) e iOS Associated Domains (`applinks:www.tripsz.com.br`).

## Quando precisa de nova versão na loja
Só se mudar algo nativo (ícone, permissões, plugin, esquema de link). Mudanças de tela, regra ou dado vão pelo deploy do site.

## Pagamento
Apple e Google exigem a compra dentro do app (In-App Purchase / Play Billing) para assinaturas digitais. Antes de publicar, decida: vender a assinatura só pelo site (e o app só libera quem já assinou) ou integrar a compra nativa.
