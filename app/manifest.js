export default function manifest() {
  return {
    name: "tripsz — roteiros de futebol",
    short_name: "tripsz",
    description: "Monte roteiros de viagem pra jogos de futebol e acompanhe seu Football Passport.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#00c853",
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
