import { ConvitePage } from "@/components/convite/ConvitePage";

// Convite pessoal: quem tem o link vê o jogo; buscadores NÃO devem indexar nem seguir.
export const metadata = {
  title: "Você foi convidado — tripsz",
  robots: { index: false, follow: false },
};

export default function Page({ params }) {
  return <ConvitePage code={params.code} />;
}
