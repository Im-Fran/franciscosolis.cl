/**
 * Quién opera este sitio, en un solo lugar.
 *
 * Todo lo que el sitio publica sobre la empresa — el pie de página, la identificación del titular
 * en las páginas legales, la firma de correo corporativa, el JSON-LD de `index.html` — sale de
 * aquí. La razón por la que existe este archivo es que la identificación de una persona jurídica
 * es un dato que la ley obliga a mostrar de forma consistente: una dirección que cambia en el
 * footer y no en los términos, o un RUT que aparece en la firma y no en la política de
 * privacidad, es exactamente el tipo de discrepancia que después hay que explicar.
 *
 * Los textos legales en sí no viven acá: el CMS los sirve desde `/legal` y sus fuentes están en
 * `docs/legal/`. Lo que este archivo aporta a esa página es el bloque de identificación, que se
 * renderiza desde el sitio y no desde el documento — así ninguna edición en el CMS puede dejar un
 * documento legal sin titular identificado.
 */

/**
 * La razón social completa, tal como está inscrita.
 *
 * Se escribe sin tildes y en mayúsculas porque así consta en el registro; no es un error de
 * digitación ni algo que "arreglar" al pasarlo a título capitalizado. Donde el diseño pida algo
 * más corto, se usa `TRADE_NAME`, nunca una versión recortada de esta.
 */
export const LEGAL_NAME =
  "DESARROLLO Y MANTENCION DE SERVICIOS INFORMATICOS FRANCISCO SOLIS MATURANA E.I.R.L.";

/** El nombre con el que la empresa se presenta. La marca, no la persona jurídica. */
export const TRADE_NAME = "FranciscoSolis";

/** Forma corta de la razón social, para firmas y espacios donde la completa no cabe. */
export const SHORT_LEGAL_NAME = "FranciscoSolis E.I.R.L.";

/**
 * El RUT de la empresa, con puntos y guion — la forma en que se lee en Chile, no la normalizada.
 *
 * Los lugares que lo muestran siguen omitiendo la fila si queda vacío: no es una defensa contra un
 * valor faltante hoy, sino contra el día en que alguien lo borre sin darse cuenta de que el dato
 * aparece en tres pantallas y en la firma de correo de todo el mundo.
 */
export const RUT = "78.473.345-9";

/** El giro, tal como lo declara la razón social. */
export const BUSINESS_ACTIVITY = "Desarrollo y mantención de servicios informáticos";

/** El domicilio comercial, en piezas para poder armar tanto una línea como un `PostalAddress`. */
export const ADDRESS = {
  street: "Av. Irarrázaval 2401, Oficina 607",
  district: "Ñuñoa",
  city: "Santiago",
  region: "Región Metropolitana",
  country: "Chile",
  countryCode: "CL",
} as const;

/** El domicilio en una línea, que es como lo muestran el footer y las páginas legales. */
export const ADDRESS_LINE = `${ADDRESS.street}, ${ADDRESS.district}, ${ADDRESS.city}, ${ADDRESS.country}`;

/** El correo por el que se ejercen los derechos y se responden las consultas legales. */
export const CONTACT_EMAIL = "fsolism@franciscosolis.cl";

export const WEBSITE = "https://franciscosolis.cl";

/** El dominio de los correos de la empresa — la puerta de la firma corporativa. */
export const EMAIL_DOMAIN = "franciscosolis.cl";

/** Los perfiles oficiales de la empresa, no los personales de quien la representa. */
export const SOCIALS = ["https://www.linkedin.com/company/franciscosolis"] as const;

/**
 * El logo en absoluto, porque se lee fuera de este origen: en un correo pegado en otra casilla o
 * en el resultado enriquecido de un buscador, una ruta relativa es una imagen rota.
 */
export const LOGO_URL = `${WEBSITE}/brand/png/fs-avatar-circle.png`;

/** Chile: el país cuya ley rige los términos y ante cuyos tribunales se someten las controversias. */
export const JURISDICTION_CITY = "Santiago";
export const JURISDICTION_COUNTRY = "Chile";

/** Todo junto, para quien prefiera un objeto a diez importaciones. */
export const COMPANY = {
  legalName: LEGAL_NAME,
  tradeName: TRADE_NAME,
  shortLegalName: SHORT_LEGAL_NAME,
  rut: RUT,
  businessActivity: BUSINESS_ACTIVITY,
  address: ADDRESS,
  addressLine: ADDRESS_LINE,
  email: CONTACT_EMAIL,
  website: WEBSITE,
  emailDomain: EMAIL_DOMAIN,
  socials: SOCIALS,
  logo: LOGO_URL,
} as const;
