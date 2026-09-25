export const metadata = {
  title: "Termos de Uso — tripsz",
};

const S = {
  page: { maxWidth: 800, margin: "0 auto", padding: "64px 24px", fontFamily: "'Inter', sans-serif", color: "#0f172a", lineHeight: 1.6 },
  h1: { fontSize: 32, fontWeight: 700, marginBottom: 8 },
  updated: { fontSize: 13, color: "#64748b", marginBottom: 40 },
  h2: { fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 },
  p: { fontSize: 15, color: "#334155", marginBottom: 16 },
  li: { fontSize: 15, color: "#334155", marginBottom: 8 },
};

export default function TermsOfUsePage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Termos de Uso</h1>
      <p style={S.updated}>Última atualização: 25 de setembro de 2026</p>

      <p style={S.p}>
        Ao usar o site do <strong>tripsz</strong>, você concorda com os termos abaixo. Leia com
        atenção antes de criar uma conta ou contratar a consultoria opcional.
      </p>

      <h2 style={S.h2}>1. O que o tripsz oferece</h2>
      <p style={S.p}>
        O tripsz cruza os países, datas e preferências que você informa com um calendário de
        partidas de futebol e sugere um roteiro de jogos possíveis e uma sequência de cidades para
        sua viagem. <strong>O roteiro em si é gratuito</strong> — não cobramos nada para gerar e
        salvar essa prévia.
      </p>
      <p style={S.p}>
        Opcionalmente, você pode contratar uma <strong>consultoria humana</strong> paga (R$ 149,90),
        que consiste numa sessão agendada com um especialista para ajudar a organizar hospedagem,
        voos, transferências e outros detalhes da viagem que não estão incluídos no roteiro gratuito.
      </p>

      <h2 style={S.h2}>2. O que o tripsz não é</h2>
      <ul>
        <li style={S.li}>Não somos uma agência de viagens nem vendemos passagens, hospedagem ou pacotes turísticos;</li>
        <li style={S.li}>Não vendemos ingressos de jogos. Os links de "ver ingressos" levam a sites de terceiros (FootballTicketNet, LiveFootballTickets), com quem você contrata diretamente — o tripsz não participa dessa transação nem garante disponibilidade, preço ou autenticidade dos ingressos vendidos por eles;</li>
        <li style={S.li}>As datas de jogos, estádios e escalações apresentadas são estimativas baseadas em calendários públicos e podem mudar por decisão das ligas, federações ou emissoras de TV — sempre confirme a data oficial antes de comprar passagens ou ingressos.</li>
      </ul>

      <h2 style={S.h2}>3. Sua conta</h2>
      <p style={S.p}>
        Você é responsável por manter a confidencialidade da sua senha e por todas as atividades
        realizadas na sua conta. Avise-nos imediatamente se suspeitar de uso não autorizado.
      </p>

      <h2 style={S.h2}>4. Pagamento da consultoria</h2>
      <ul>
        <li style={S.li}>O pagamento é processado pelo Mercado Pago; não temos acesso aos dados do seu cartão;</li>
        <li style={S.li}>Nos termos do Art. 49 do Código de Defesa do Consumidor, você tem <strong>7 dias corridos</strong> após a contratação para desistir e solicitar reembolso integral, desde que a sessão de consultoria ainda não tenha sido realizada;</li>
        <li style={S.li}>Após a sessão de consultoria ser realizada, o serviço é considerado prestado e não é reembolsável;</li>
        <li style={S.li}>Reagendamentos podem ser solicitados com pelo menos 24 horas de antecedência da sessão marcada.</li>
      </ul>

      <h2 style={S.h2}>5. Uso permitido</h2>
      <p style={S.p}>Ao usar o tripsz, você concorda em não:</p>
      <ul>
        <li style={S.li}>Fornecer informações falsas no cadastro;</li>
        <li style={S.li}>Tentar acessar dados de outros usuários ou burlar mecanismos de segurança do site;</li>
        <li style={S.li}>Usar o site para fins ilegais ou que violem direitos de terceiros.</li>
      </ul>

      <h2 style={S.h2}>6. Limitação de responsabilidade</h2>
      <p style={S.p}>
        O tripsz se esforça para manter as informações de jogos atualizadas, mas não garante que
        todas as partidas sugeridas de fato ocorrerão nas datas e locais indicados. Não nos
        responsabilizamos por prejuízos decorrentes de mudanças de data, cancelamento de eventos,
        ou por problemas em compras feitas em sites de terceiros linkados a partir do tripsz.
      </p>

      <h2 style={S.h2}>7. Alterações destes termos</h2>
      <p style={S.p}>
        Podemos atualizar estes termos periodicamente. O uso continuado do site após uma alteração
        implica concordância com os novos termos.
      </p>

      <h2 style={S.h2}>8. Lei aplicável</h2>
      <p style={S.p}>
        Estes termos são regidos pelas leis da República Federativa do Brasil. Eventuais disputas
        serão resolvidas no foro do domicílio do consumidor, conforme o Código de Defesa do
        Consumidor.
      </p>

      <h2 style={S.h2}>9. Contato</h2>
      <p style={S.p}>
        Dúvidas sobre estes termos podem ser enviadas para <strong>[e-mail de contato a definir]</strong>.
      </p>
    </div>
  );
}
