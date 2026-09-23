export const metadata = {
  title: "tripsz — roteiros de futebol",
  description: "Roteiros de viagem personalizados para fanáticos por futebol.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
