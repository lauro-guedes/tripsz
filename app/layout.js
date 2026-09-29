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
      <body>{children}</body>
    </html>
  );
}
