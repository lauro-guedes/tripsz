import TripszApp from "../../components/TripszApp";

// Rota coringa: qualquer caminho (/roteiro/destino, /conta/perfil, etc)
// cai aqui e renderiza o mesmo app. Sem isso, dar F5 numa URL que só
// existia via navegação interna (window.history) resultaria em 404,
// porque o Next.js só conhece de verdade a rota "/" (app/page.js).
//
// force-dynamic: essa rota nunca deve ser otimizada/cacheada — sem
// isso, existe risco de uma versão errada (de outra rota, tipo o
// perfil público) ficar presa em cache e aparecer aqui por engano.
export const dynamic = "force-dynamic";

export default function Page() {
  return <TripszApp />;
}
