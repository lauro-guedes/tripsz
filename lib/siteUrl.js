/** Endereço público do site (sem barra no final). A variável NEXT_PUBLIC_SITE_URL manda; o padrão é o domínio oficial. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tripsz.com.br").replace(/\/+$/, "");
