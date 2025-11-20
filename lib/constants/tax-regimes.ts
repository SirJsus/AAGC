// Regímenes fiscales del SAT (México)
// Fuente: Catálogo de regímenes fiscales del SAT

export interface TaxRegime {
  code: string;
  description: string;
}

export const TAX_REGIMES: TaxRegime[] = [
  { code: "601", description: "General de Ley Personas Morales" },
  { code: "602", description: "Simplificado de Ley Personas Morales" },
  { code: "603", description: "Personas Morales con Fines no Lucrativos" },
  {
    code: "604",
    description: "Pequeños Contribuyentes",
  },
  {
    code: "605",
    description: "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  },
  { code: "606", description: "Arrendamiento" },
  {
    code: "607",
    description: "Régimen de Enajenación o Adquisición de Bienes",
  },
  { code: "608", description: "Demás ingresos" },
  { code: "609", description: "Consolidación" },
  {
    code: "610",
    description:
      "Residentes en el Extranjero sin Establecimiento Permanente en México",
  },
  {
    code: "611",
    description: "Ingresos por Dividendos (socios y accionistas)",
  },
  {
    code: "612",
    description:
      "Personas Físicas con Actividades Empresariales y Profesionales",
  },
  {
    code: "613",
    description:
      "Intermedio de las personas Físicas con Actividades Empresariales",
  },
  { code: "614", description: "Ingresos por intereses" },
  {
    code: "615",
    description: "Régimen de los Ingresos por obtención de premios",
  },
  { code: "616", description: "Sin obligaciones fiscales" },
  { code: "617", description: "Pemex" },
  { code: "618", description: "Simplificado de Ley Personas Físicas" },
  { code: "619", description: "Ingresos por la Obtención de Préstamos" },
  {
    code: "620",
    description:
      "Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
  },
  { code: "621", description: "Incorporación Fiscal" },
  {
    code: "622",
    description: "Actividades Agrícolas, Ganaderas, SilvÍcolas y Pesqueras PM",
  },
  { code: "623", description: "Opcional para Grupos de Sociedades" },
  { code: "624", description: "Coordinados" },
  {
    code: "625",
    description:
      "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  },
  { code: "626", description: "Simplificado de Confianza" },
  { code: "628", description: "Hidrocarburos" },
  {
    code: "629",
    description:
      "De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales",
  },
  { code: "630", description: "Enajenación de acciones en bolsa de valores" },
];

// Helper function to get regime description by code
export function getTaxRegimeDescription(code: string): string {
  const regime = TAX_REGIMES.find((r) => r.code === code);
  return regime ? `${regime.code} - ${regime.description}` : code;
}

// Helper function to format regime for display
export function formatTaxRegime(code: string): string {
  const regime = TAX_REGIMES.find((r) => r.code === code);
  return regime ? `${regime.code} - ${regime.description}` : code;
}
