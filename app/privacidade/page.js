export const metadata = {
  title: "Política de Privacidade — tripsz",
};

const S = {
  page: { maxWidth: 800, margin: "0 auto", padding: "64px 24px", fontFamily: "'Inter', sans-serif", color: "#0f172a", lineHeight: 1.6 },
  h1: { fontSize: 32, fontWeight: 700, marginBottom: 8 },
  updated: { fontSize: 13, color: "#64748b", marginBottom: 40 },
  h2: { fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 },
  p: { fontSize: 15, color: "#334155", marginBottom: 16 },
  li: { fontSize: 15, color: "#334155", marginBottom: 8 },
};

export default function PrivacyPolicyPage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Política de Privacidade</h1>
      <p style={S.updated}>Última atualização: 25 de setembro de 2026</p>

      <p style={S.p}>
        Esta Política de Privacidade explica como o <strong>tripsz</strong> ("nós") coleta, usa,
        armazena e protege os dados pessoais de quem usa nosso site, em conformidade com a Lei
        Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2 style={S.h2}>1. Quais dados coletamos</h2>
      <ul>
        <li style={S.li}><strong>Dados de cadastro:</strong> nome, e-mail e número de WhatsApp, fornecidos por você ao criar uma conta (ou, se você optar por entrar com o Google, recebemos nome e e-mail associados à sua conta Google).</li>
        <li style={S.li}><strong>Respostas do questionário de viagem:</strong> países de interesse, datas, número de viajantes, orçamento e preferências, usadas para montar seu roteiro.</li>
        <li style={S.li}><strong>Dados de pagamento:</strong> ao contratar a consultoria humana opcional, o pagamento é processado inteiramente pelo Mercado Pago. Nós não armazenamos número de cartão, CVC ou dados bancários — apenas o status do pedido (pago, pendente) e a data/horário escolhidos para a sessão de consultoria.</li>
        <li style={S.li}><strong>Dados de uso:</strong> informações técnicas básicas de navegação (como progresso no questionário), guardadas localmente no seu navegador para você não perder o preenchimento entre uma etapa e outra.</li>
      </ul>

      <h2 style={S.h2}>2. Para que usamos seus dados</h2>
      <ul>
        <li style={S.li}>Gerar e salvar o roteiro de futebol que você solicitou;</li>
        <li style={S.li}>Autenticar seu acesso à conta e manter sua sessão ativa;</li>
        <li style={S.li}>Processar o pagamento e agendamento da consultoria humana, quando contratada;</li>
        <li style={S.li}>Entrar em contato pelo e-mail ou WhatsApp informado, para assuntos relacionados à sua conta ou consultoria contratada;</li>
        <li style={S.li}>Cumprir obrigações legais e fiscais relacionadas aos pagamentos processados.</li>
      </ul>

      <h2 style={S.h2}>3. Com quem compartilhamos dados</h2>
      <p style={S.p}>Usamos os seguintes prestadores de serviço para operar o tripsz, cada um com sua própria política de privacidade:</p>
      <ul>
        <li style={S.li}><strong>Supabase</strong> — banco de dados e autenticação de usuários;</li>
        <li style={S.li}><strong>Google</strong> — login social opcional (OAuth);</li>
        <li style={S.li}><strong>Mercado Pago</strong> — processamento de pagamentos da consultoria;</li>
        <li style={S.li}><strong>Vercel</strong> — hospedagem do site;</li>
        <li style={S.li}><strong>API-Football</strong> — fornecimento de dados públicos de jogos e times (não recebe seus dados pessoais);</li>
        <li style={S.li}><strong>FootballTicketNet e LiveFootballTickets (rede Awin)</strong> — quando você clica num link de "ver ingressos", é redirecionado ao site desses parceiros; nenhum dado seu é compartilhado com eles nesse clique além do fato de que você veio do tripsz (para fins de comissão de afiliado).</li>
      </ul>
      <p style={S.p}>Não vendemos seus dados pessoais a terceiros para fins de publicidade.</p>

      <h2 style={S.h2}>4. Seus direitos como titular dos dados</h2>
      <p style={S.p}>Nos termos da LGPD, você pode a qualquer momento:</p>
      <ul>
        <li style={S.li}>Confirmar a existência de tratamento dos seus dados;</li>
        <li style={S.li}>Acessar, corrigir ou atualizar seus dados (em Meu Perfil, dentro da sua conta);</li>
        <li style={S.li}>Solicitar a exclusão da sua conta e dos dados associados;</li>
        <li style={S.li}>Revogar o consentimento dado anteriormente;</li>
        <li style={S.li}>Solicitar a portabilidade dos seus dados a outro fornecedor;</li>
        <li style={S.li}>Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p style={S.p}>Para exercer qualquer desses direitos, entre em contato pelo e-mail informado na seção 7.</p>

      <h2 style={S.h2}>5. Por quanto tempo guardamos seus dados</h2>
      <p style={S.p}>
        Mantemos seus dados enquanto sua conta estiver ativa. Se você solicitar a exclusão da conta,
        removemos seus dados pessoais em até 30 dias, exceto informações que sejamos legalmente
        obrigados a manter (como registros fiscais de pagamentos já realizados).
      </p>

      <h2 style={S.h2}>6. Segurança</h2>
      <p style={S.p}>
        Usamos práticas padrão de mercado para proteger seus dados, incluindo criptografia em
        trânsito (HTTPS), controle de acesso por autenticação e políticas de segurança em nível de
        linha de banco de dados (Row Level Security), que garantem que cada pessoa só acessa seus
        próprios dados.
      </p>

      <h2 style={S.h2}>7. Contato</h2>
      <p style={S.p}>
        Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas para{" "}
        <strong>[e-mail de contato a definir]</strong>.
      </p>

      <h2 style={S.h2}>8. Alterações desta política</h2>
      <p style={S.p}>
        Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas por
        e-mail ou por aviso no site antes de entrarem em vigor.
      </p>
    </div>
  );
}
