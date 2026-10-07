/**
 * Clássicos e rivalidades REAIS — o que o Montar Viagem chama de "clássico".
 *
 * A API de jogos não diz quais jogos são clássicos, então esta lista é
 * mantida à mão. Cada linha: os dois lados (cada lado pode ter mais de um
 * jeito de escrever o nome do time, como a API-Football escreve) e o nome
 * conhecido do clássico, que aparece na tela.
 *
 * Os nomes são comparados sem acento, sem maiúscula e sem espaço/pontuação
 * ("Bayern München" = "bayern munchen"). Se um clássico não estiver sendo
 * reconhecido, o nome do time na API deve estar escrito diferente: é só
 * acrescentar o jeito certo no lado correspondente.
 */
export const RIVALRIES = [
  // Inglaterra
  { a: ["Arsenal"], b: ["Tottenham", "Tottenham Hotspur"], name: "North London Derby" },
  { a: ["Arsenal"], b: ["Chelsea"], name: "London Derby" },
  { a: ["Chelsea"], b: ["Tottenham", "Tottenham Hotspur"], name: "London Derby" },
  { a: ["Liverpool"], b: ["Everton"], name: "Merseyside Derby" },
  { a: ["Manchester United"], b: ["Manchester City"], name: "Manchester Derby" },
  { a: ["Manchester United"], b: ["Liverpool"], name: "North West Derby" },
  { a: ["Liverpool"], b: ["Manchester City"], name: "Clássico moderno da Inglaterra" },
  { a: ["Newcastle", "Newcastle United"], b: ["Sunderland"], name: "Tyne–Wear Derby" },
  { a: ["Aston Villa"], b: ["Birmingham", "Birmingham City"], name: "Second City Derby" },
  // Espanha
  { a: ["Real Madrid"], b: ["Barcelona", "FC Barcelona"], name: "El Clásico" },
  { a: ["Atletico Madrid", "Atlético Madrid"], b: ["Real Madrid"], name: "Derbi madrileño" },
  { a: ["Sevilla"], b: ["Real Betis", "Betis"], name: "Derbi sevillano" },
  { a: ["Barcelona", "FC Barcelona"], b: ["Espanyol"], name: "Derbi barceloní" },
  { a: ["Athletic Club", "Athletic Bilbao"], b: ["Real Sociedad"], name: "Derbi vasco" },
  { a: ["Valencia"], b: ["Levante", "Levante UD"], name: "Derbi valenciano" },
  // Itália
  { a: ["Inter", "Inter Milan", "Internazionale"], b: ["AC Milan", "Milan"], name: "Derby della Madonnina" },
  { a: ["AS Roma", "Roma"], b: ["Lazio"], name: "Derby della Capitale" },
  { a: ["Juventus"], b: ["Torino"], name: "Derby della Mole" },
  { a: ["Juventus"], b: ["Inter", "Inter Milan", "Internazionale"], name: "Derby d'Italia" },
  { a: ["Juventus"], b: ["AC Milan", "Milan"], name: "Clássico italiano" },
  { a: ["Napoli"], b: ["AS Roma", "Roma"], name: "Derby del Sole" },
  { a: ["Genoa"], b: ["Sampdoria"], name: "Derby della Lanterna" },
  // Alemanha
  { a: ["Bayern Munchen", "Bayern Munich", "FC Bayern Munchen"], b: ["Borussia Dortmund"], name: "Der Klassiker" },
  { a: ["Borussia Dortmund"], b: ["Schalke 04", "FC Schalke 04"], name: "Revierderby" },
  { a: ["Hamburger SV"], b: ["FC St. Pauli", "St. Pauli"], name: "Hamburger Stadtderby" },
  { a: ["Borussia Monchengladbach"], b: ["FC Koln", "1. FC Koln", "Koln"], name: "Rheinderby" },
  { a: ["Werder Bremen"], b: ["Hamburger SV"], name: "Nordderby" },
  { a: ["Hertha Berlin", "Hertha BSC"], b: ["Union Berlin", "1. FC Union Berlin"], name: "Berliner Stadtderby" },
  // França
  { a: ["Paris Saint Germain", "Paris Saint-Germain", "PSG"], b: ["Marseille", "Olympique Marseille"], name: "Le Classique" },
  { a: ["Lyon", "Olympique Lyonnais"], b: ["Saint Etienne", "AS Saint-Etienne"], name: "Derby Rhône-Alpes" },
  { a: ["Lille"], b: ["Lens"], name: "Derby du Nord" },
  // Portugal
  { a: ["Benfica"], b: ["FC Porto", "Porto"], name: "O Clássico" },
  { a: ["Benfica"], b: ["Sporting CP", "Sporting Lisbon"], name: "Derby de Lisboa" },
  { a: ["Sporting CP", "Sporting Lisbon"], b: ["FC Porto", "Porto"], name: "Clássico português" },
  { a: ["Sporting Braga", "SC Braga", "Braga"], b: ["Vitoria Guimaraes", "Vitória Guimarães"], name: "Derby do Minho" },
  // Holanda
  { a: ["Ajax"], b: ["Feyenoord"], name: "De Klassieker" },
  { a: ["Ajax"], b: ["PSV Eindhoven", "PSV"], name: "Clássico holandês" },
  { a: ["Feyenoord"], b: ["PSV Eindhoven", "PSV"], name: "Clássico holandês" },
  // Turquia
  { a: ["Galatasaray"], b: ["Fenerbahce"], name: "Derby intercontinental" },
  { a: ["Fenerbahce"], b: ["Besiktas"], name: "Derby de Istambul" },
  { a: ["Galatasaray"], b: ["Besiktas"], name: "Derby de Istambul" },
  { a: ["Trabzonspor"], b: ["Fenerbahce"], name: "Clássico turco" },
  // Argentina
  { a: ["Boca Juniors"], b: ["River Plate"], name: "Superclásico" },
  { a: ["Racing Club"], b: ["Independiente"], name: "Clásico de Avellaneda" },
  { a: ["San Lorenzo"], b: ["Huracan"], name: "Clásico del Bajo Flores" },
  { a: ["Newells Old Boys", "Newell's Old Boys"], b: ["Rosario Central"], name: "Clásico rosarino" },
  { a: ["Estudiantes L.P.", "Estudiantes La Plata"], b: ["Gimnasia L.P.", "Gimnasia La Plata"], name: "Clásico platense" },
  // Brasil
  { a: ["Flamengo"], b: ["Fluminense"], name: "Fla-Flu" },
  { a: ["Flamengo"], b: ["Vasco DA Gama", "Vasco da Gama"], name: "Clássico dos Milhões" },
  { a: ["Fluminense"], b: ["Botafogo"], name: "Clássico Vovô" },
  { a: ["Flamengo"], b: ["Botafogo"], name: "Clássico da Rivalidade" },
  { a: ["Corinthians"], b: ["Palmeiras"], name: "Derby Paulista" },
  { a: ["Corinthians"], b: ["Sao Paulo", "São Paulo"], name: "Majestoso" },
  { a: ["Palmeiras"], b: ["Sao Paulo", "São Paulo"], name: "Choque-Rei" },
  { a: ["Palmeiras"], b: ["Santos"], name: "Clássico da Saudade" },
  { a: ["Gremio", "Grêmio"], b: ["Internacional"], name: "Gre-Nal" },
  { a: ["Atletico-MG", "Atletico Mineiro", "Atlético Mineiro"], b: ["Cruzeiro"], name: "Clássico Mineiro" },
  { a: ["Bahia"], b: ["Vitoria", "Vitória"], name: "Ba-Vi" },
  { a: ["Fortaleza", "Fortaleza EC"], b: ["Ceara", "Ceará"], name: "Clássico-Rei" },
  { a: ["Sport Recife", "Sport"], b: ["Nautico Recife", "Náutico"], name: "Clássico dos Clássicos" },
  { a: ["Athletico Paranaense", "Atletico Paranaense", "Athletico-PR"], b: ["Coritiba"], name: "Atletiba" },
  // Uruguai, Chile, Colômbia
  { a: ["Penarol", "Peñarol"], b: ["Nacional"], name: "Clásico uruguayo" },
  { a: ["Colo-Colo", "Colo Colo"], b: ["Universidad de Chile"], name: "Superclásico chileno" },
  { a: ["Universidad Catolica", "Universidad Católica"], b: ["Universidad de Chile"], name: "Clásico Universitario" },
  { a: ["Millonarios"], b: ["Independiente Santa Fe", "Santa Fe"], name: "Clásico Capitalino" },
  { a: ["Atletico Nacional", "Atlético Nacional"], b: ["Independiente Medellin", "Medellin"], name: "Clásico Paisa" },
  { a: ["America de Cali", "América de Cali"], b: ["Deportivo Cali"], name: "Clásico Vallecaucano" },
  { a: ["Millonarios"], b: ["Atletico Nacional", "Atlético Nacional"], name: "Clásico colombiano" },
];
