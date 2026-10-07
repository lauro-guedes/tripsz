import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tripsz.vercel.app"),
  title: {
    default: "tripsz — o melhor roteiro de futebol para sua viagem",
    template: "%s · tripsz",
  },
  description:
    "Escolha países, datas e times: a tripsz cruza as partidas disponíveis e entrega os jogos possíveis e a melhor sequência de cidades para sua viagem. Grátis.",
  keywords: [
    "roteiro de futebol",
    "viagem para jogos de futebol",
    "groundhopping",
    "turismo esportivo",
    "ingressos de futebol",
  ],
  openGraph: {
    title: "tripsz — o melhor roteiro de futebol para sua viagem",
    description:
      "Escolha países, datas e times: a tripsz cruza as partidas disponíveis e entrega os jogos possíveis e a melhor sequência de cidades para sua viagem.",
    url: "/",
    siteName: "tripsz",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "tripsz — o melhor roteiro de futebol para sua viagem",
    description:
      "Escolha países, datas e times: a tripsz cruza as partidas disponíveis e entrega os jogos possíveis e a melhor sequência de cidades para sua viagem.",
  },
  // A partir daqui é o que faz o site virar um PWA de verdade — permite
  // "Adicionar à Tela de Início" no iPhone/Android com aparência de app
  // nativo (sem barra de endereço, ícone próprio, cor de tema).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "tripsz",
  },
};

export const viewport = {
  themeColor: "#00c853",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Tela de carregamento ESTÁTICA — não depende de nenhum
            JavaScript pra aparecer, então some no primeiro instante que
            a página abre (resolve a demora de ~7s parecendo "travado"
            ao abrir o app instalado). Ela mesma se remove sozinha assim
            que o app de verdade termina de carregar (veja o App() em
            components/TripszApp.jsx, que remove esse elemento no
            primeiro useEffect). Se o JavaScript falhar por algum motivo,
            ela também some sozinha depois de 10 segundos, pra nunca
            travar a pessoa numa tela de carregamento eterna. */}
        <div
          id="app-shell-loader"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <img src="/simbolo-tripsz.svg" alt="" width={75} height={64} style={{ display: "block" }} />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: "#00c853",
              animation: "app-shell-spin 0.8s linear infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes app-shell-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function () {
              var el = document.getElementById("app-shell-loader");
              if (el) el.remove();
            }, 10000);`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
