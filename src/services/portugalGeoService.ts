// portugalGeoService.ts
// Geographic coordinates and geocoding helper for Portugal mainland & islands

export interface LocationCoordinates {
  lat: number;
  lng: number;
  cidade: string;
  distrito: string;
  regiao: 'Norte' | 'Centro' | 'Lisboa & V.T.' | 'Alentejo' | 'Algarve' | 'Madeira' | 'Açores';
}

// Oficina HP Base HQ (GRAUMP - Albergaria-a-Velha)
export const OFICINA_HP_BASE = {
  nome: 'Oficina HP (Sede GRAUMP)',
  morada: 'Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha',
  lat: 40.6922,
  lng: -8.4806,
  distrito: 'Aveiro',
  concelho: 'Albergaria-a-Velha'
};

// Exact 4-digit postal code dictionary for Portugal
const PORTUGAL_POSTAL_CODES_EXACT: Record<number, LocationCoordinates> = {
  // Algarve
  8125: { lat: 37.0789, lng: -8.1189, cidade: 'Vilamoura / Quarteira', distrito: 'Faro', regiao: 'Algarve' },
  8135: { lat: 37.0869, lng: -8.0319, cidade: 'Almancil', distrito: 'Faro', regiao: 'Algarve' },
  8100: { lat: 37.1383, lng: -8.0225, cidade: 'Loulé', distrito: 'Faro', regiao: 'Algarve' },
  8150: { lat: 37.1517, lng: -7.8864, cidade: 'São Brás de Alportel', distrito: 'Faro', regiao: 'Algarve' },
  8000: { lat: 37.0194, lng: -7.9304, cidade: 'Faro', distrito: 'Faro', regiao: 'Algarve' },
  8005: { lat: 37.0350, lng: -7.9350, cidade: 'Faro (Montenegro/Gambelas)', distrito: 'Faro', regiao: 'Algarve' },
  8200: { lat: 37.0894, lng: -8.2469, cidade: 'Albufeira', distrito: 'Faro', regiao: 'Algarve' },
  8300: { lat: 37.1889, lng: -8.4389, cidade: 'Silves', distrito: 'Faro', regiao: 'Algarve' },
  8365: { lat: 37.1025, lng: -8.3611, cidade: 'Armação de Pêra', distrito: 'Faro', regiao: 'Algarve' },
  8400: { lat: 37.1347, lng: -8.4528, cidade: 'Lagoa / Carvoeiro', distrito: 'Faro', regiao: 'Algarve' },
  8500: { lat: 37.1364, lng: -8.5378, cidade: 'Portimão / Alvor', distrito: 'Faro', regiao: 'Algarve' },
  8550: { lat: 37.3175, lng: -8.5556, cidade: 'Monchique', distrito: 'Faro', regiao: 'Algarve' },
  8600: { lat: 37.1028, lng: -8.6731, cidade: 'Lagos', distrito: 'Faro', regiao: 'Algarve' },
  8650: { lat: 37.0086, lng: -8.9397, cidade: 'Sagres / Vila do Bispo', distrito: 'Faro', regiao: 'Algarve' },
  8670: { lat: 37.3189, lng: -8.8028, cidade: 'Aljezur', distrito: 'Faro', regiao: 'Algarve' },
  8700: { lat: 37.0289, lng: -7.8411, cidade: 'Olhão / Fuseta', distrito: 'Faro', regiao: 'Algarve' },
  8800: { lat: 37.1264, lng: -7.6497, cidade: 'Tavira', distrito: 'Faro', regiao: 'Algarve' },
  8900: { lat: 37.1947, lng: -7.4172, cidade: 'Vila Real de Santo António / Monte Gordo', distrito: 'Faro', regiao: 'Algarve' },
  8950: { lat: 37.2181, lng: -7.4428, cidade: 'Castro Marim', distrito: 'Faro', regiao: 'Algarve' },
  8970: { lat: 37.4719, lng: -7.4719, cidade: 'Alcoutim', distrito: 'Faro', regiao: 'Algarve' },

  // Aveiro / Centro
  3850: { lat: 40.6922, lng: -8.4806, cidade: 'Albergaria-a-Velha', distrito: 'Aveiro', regiao: 'Centro' },
  3800: { lat: 40.6405, lng: -8.6538, cidade: 'Aveiro', distrito: 'Aveiro', regiao: 'Centro' },
  3750: { lat: 40.5756, lng: -8.4489, cidade: 'Águeda', distrito: 'Aveiro', regiao: 'Centro' },
  3830: { lat: 40.6019, lng: -8.6689, cidade: 'Ílhavo', distrito: 'Aveiro', regiao: 'Centro' },
  3880: { lat: 40.8586, lng: -8.6256, cidade: 'Ovar', distrito: 'Aveiro', regiao: 'Centro' },
  3860: { lat: 40.7547, lng: -8.5694, cidade: 'Estarreja', distrito: 'Aveiro', regiao: 'Centro' },
  3700: { lat: 40.9022, lng: -8.4906, cidade: 'São João da Madeira', distrito: 'Aveiro', regiao: 'Norte' },
  3720: { lat: 40.8389, lng: -8.4764, cidade: 'Oliveira de Azeméis', distrito: 'Aveiro', regiao: 'Norte' },
  3780: { lat: 40.4439, lng: -8.4347, cidade: 'Anadia', distrito: 'Aveiro', regiao: 'Centro' },
  3050: { lat: 40.3789, lng: -8.4514, cidade: 'Mealhada', distrito: 'Aveiro', regiao: 'Centro' },
  3840: { lat: 40.5542, lng: -8.6811, cidade: 'Vagos', distrito: 'Aveiro', regiao: 'Centro' },
  4520: { lat: 40.9250, lng: -8.5422, cidade: 'Santa Maria da Feira', distrito: 'Aveiro', regiao: 'Norte' },
  4500: { lat: 41.0072, lng: -8.6417, cidade: 'Espinho', distrito: 'Aveiro', regiao: 'Norte' },

  // Porto & Grande Porto
  4000: { lat: 41.1579, lng: -8.6291, cidade: 'Porto', distrito: 'Porto', regiao: 'Norte' },
  4400: { lat: 41.1239, lng: -8.6119, cidade: 'Vila Nova de Gaia', distrito: 'Porto', regiao: 'Norte' },
  4450: { lat: 41.1822, lng: -8.6964, cidade: 'Matosinhos / Leça', distrito: 'Porto', regiao: 'Norte' },
  4470: { lat: 41.2356, lng: -8.6214, cidade: 'Maia', distrito: 'Porto', regiao: 'Norte' },
  4420: { lat: 41.1444, lng: -8.5319, cidade: 'Gondomar', distrito: 'Porto', regiao: 'Norte' },
  4440: { lat: 41.1889, lng: -8.4989, cidade: 'Valongo / Ermesinde', distrito: 'Porto', regiao: 'Norte' },
  4480: { lat: 41.3547, lng: -8.7431, cidade: 'Vila do Conde', distrito: 'Porto', regiao: 'Norte' },
  4490: { lat: 41.3833, lng: -8.7619, cidade: 'Póvoa de Varzim', distrito: 'Porto', regiao: 'Norte' },
  4780: { lat: 41.3439, lng: -8.4739, cidade: 'Santo Tirso', distrito: 'Porto', regiao: 'Norte' },
  4785: { lat: 41.3389, lng: -8.5603, cidade: 'Trofa', distrito: 'Porto', regiao: 'Norte' },
  4560: { lat: 41.2056, lng: -8.2831, cidade: 'Penafiel', distrito: 'Porto', regiao: 'Norte' },
  4580: { lat: 41.2069, lng: -8.3303, cidade: 'Paredes', distrito: 'Porto', regiao: 'Norte' },
  4590: { lat: 41.2789, lng: -8.3844, cidade: 'Paços de Ferreira', distrito: 'Porto', regiao: 'Norte' },
  4600: { lat: 41.2725, lng: -8.0825, cidade: 'Amarante', distrito: 'Porto', regiao: 'Norte' },

  // Braga & Minho
  4700: { lat: 41.5454, lng: -8.4265, cidade: 'Braga', distrito: 'Braga', regiao: 'Norte' },
  4760: { lat: 41.4078, lng: -8.5197, cidade: 'Vila Nova de Famalicão', distrito: 'Braga', regiao: 'Norte' },
  4800: { lat: 41.4425, lng: -8.2917, cidade: 'Guimarães', distrito: 'Braga', regiao: 'Norte' },
  4750: { lat: 41.5317, lng: -8.6186, cidade: 'Barcelos', distrito: 'Braga', regiao: 'Norte' },
  4740: { lat: 41.5350, lng: -8.7806, cidade: 'Esposende', distrito: 'Braga', regiao: 'Norte' },
  4820: { lat: 41.4503, lng: -8.1736, cidade: 'Fafe', distrito: 'Braga', regiao: 'Norte' },
  4900: { lat: 41.6932, lng: -8.8329, cidade: 'Viana do Castelo', distrito: 'Viana do Castelo', regiao: 'Norte' },
  4990: { lat: 41.7675, lng: -8.5833, cidade: 'Ponte de Lima', distrito: 'Viana do Castelo', regiao: 'Norte' },
  4930: { lat: 42.0294, lng: -8.6444, cidade: 'Valença', distrito: 'Viana do Castelo', regiao: 'Norte' },

  // Lisboa & Sul Tejo
  1000: { lat: 38.7223, lng: -9.1393, cidade: 'Lisboa', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2700: { lat: 38.7594, lng: -9.2239, cidade: 'Amadora', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2675: { lat: 38.7933, lng: -9.1836, cidade: 'Odivelas', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2670: { lat: 38.8311, lng: -9.1683, cidade: 'Loures', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2600: { lat: 38.9553, lng: -8.9897, cidade: 'Vila Franca de Xira', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2615: { lat: 38.8986, lng: -9.0394, cidade: 'Alverca do Ribatejo', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2710: { lat: 38.8029, lng: -9.3817, cidade: 'Sintra', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2750: { lat: 38.6979, lng: -9.4215, cidade: 'Cascais', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2780: { lat: 38.6969, lng: -9.3106, cidade: 'Oeiras', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2640: { lat: 38.9372, lng: -9.3267, cidade: 'Mafra', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  2560: { lat: 39.0919, lng: -9.2589, cidade: 'Torres Vedras', distrito: 'Lisboa', regiao: 'Centro' },
  2800: { lat: 38.6792, lng: -9.1569, cidade: 'Almada', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  2840: { lat: 38.6417, lng: -9.1039, cidade: 'Seixal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  2830: { lat: 38.6631, lng: -9.0725, cidade: 'Barreiro', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  2870: { lat: 38.7067, lng: -8.9739, cidade: 'Montijo', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  2900: { lat: 38.5244, lng: -8.8882, cidade: 'Setúbal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  2950: { lat: 38.5683, lng: -8.9039, cidade: 'Palmela', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  7520: { lat: 37.9561, lng: -8.8697, cidade: 'Sines', distrito: 'Setúbal', regiao: 'Alentejo' },
  7540: { lat: 38.0167, lng: -8.6944, cidade: 'Santiago do Cacém', distrito: 'Setúbal', regiao: 'Alentejo' },

  // Alentejo
  7000: { lat: 38.5714, lng: -7.9135, cidade: 'Évora', distrito: 'Évora', regiao: 'Alentejo' },
  7040: { lat: 38.7239, lng: -7.9847, cidade: 'Arraiolos', distrito: 'Évora', regiao: 'Alentejo' },
  7050: { lat: 38.6467, lng: -8.2164, cidade: 'Montemor-o-Novo', distrito: 'Évora', regiao: 'Alentejo' },
  7080: { lat: 38.6797, lng: -8.4578, cidade: 'Vendas Novas', distrito: 'Évora', regiao: 'Alentejo' },
  7100: { lat: 38.8417, lng: -7.5878, cidade: 'Estremoz', distrito: 'Évora', regiao: 'Alentejo' },
  7150: { lat: 38.8056, lng: -7.4556, cidade: 'Borba', distrito: 'Évora', regiao: 'Alentejo' },
  7160: { lat: 38.7817, lng: -7.4189, cidade: 'Vila Viçosa', distrito: 'Évora', regiao: 'Alentejo' },
  7200: { lat: 38.4247, lng: -7.5347, cidade: 'Reguengos de Monsaraz', distrito: 'Évora', regiao: 'Alentejo' },
  7220: { lat: 38.3072, lng: -7.7039, cidade: 'Portel', distrito: 'Évora', regiao: 'Alentejo' },
  7300: { lat: 39.2936, lng: -7.4311, cidade: 'Portalegre', distrito: 'Portalegre', regiao: 'Alentejo' },
  7350: { lat: 38.8817, lng: -7.1628, cidade: 'Elvas', distrito: 'Portalegre', regiao: 'Alentejo' },
  7370: { lat: 39.0139, lng: -7.0694, cidade: 'Campo Maior', distrito: 'Portalegre', regiao: 'Alentejo' },
  7400: { lat: 39.2489, lng: -8.0125, cidade: 'Ponte de Sor', distrito: 'Portalegre', regiao: 'Alentejo' },
  7570: { lat: 38.1764, lng: -8.5678, cidade: 'Grândola', distrito: 'Setúbal', regiao: 'Alentejo' },
  7580: { lat: 38.3725, lng: -8.5139, cidade: 'Alcácer do Sal', distrito: 'Setúbal', regiao: 'Alentejo' },
  7600: { lat: 37.8767, lng: -8.1639, cidade: 'Aljustrel', distrito: 'Beja', regiao: 'Alentejo' },
  7630: { lat: 37.5975, lng: -8.6419, cidade: 'Odemira', distrito: 'Beja', regiao: 'Alentejo' },
  7700: { lat: 37.5117, lng: -8.0617, cidade: 'Almodôvar', distrito: 'Beja', regiao: 'Alentejo' },
  7750: { lat: 37.6406, lng: -7.6631, cidade: 'Mértola', distrito: 'Beja', regiao: 'Alentejo' },
  7780: { lat: 37.6989, lng: -8.0847, cidade: 'Castro Verde', distrito: 'Beja', regiao: 'Alentejo' },
  7800: { lat: 38.0150, lng: -7.8653, cidade: 'Beja', distrito: 'Beja', regiao: 'Alentejo' },
  7830: { lat: 37.9444, lng: -7.5972, cidade: 'Serpa', distrito: 'Beja', regiao: 'Alentejo' },
  7860: { lat: 38.1408, lng: -7.4497, cidade: 'Moura', distrito: 'Beja', regiao: 'Alentejo' },
  7900: { lat: 38.0583, lng: -8.1139, cidade: 'Ferreira do Alentejo', distrito: 'Beja', regiao: 'Alentejo' },
  7920: { lat: 38.2575, lng: -7.9917, cidade: 'Alvito', distrito: 'Beja', regiao: 'Alentejo' },
  7940: { lat: 38.1656, lng: -7.8925, cidade: 'Cuba', distrito: 'Beja', regiao: 'Alentejo' },
  7960: { lat: 38.2147, lng: -7.8189, cidade: 'Vila de Frades / Vidigueira', distrito: 'Beja', regiao: 'Alentejo' }
};

// Database of Portuguese Municipalities, Cities, Towns & Key Landmarks
const PORTUGAL_CITIES: Record<string, LocationCoordinates> = {
  // --- ALENTEJO ---
  'vila de frades': { lat: 38.2147, lng: -7.8189, cidade: 'Vila de Frades', distrito: 'Beja', regiao: 'Alentejo' },
  'vidigueira': { lat: 38.1889, lng: -7.8000, cidade: 'Vidigueira', distrito: 'Beja', regiao: 'Alentejo' },
  'cuba': { lat: 38.1656, lng: -7.8925, cidade: 'Cuba (Alentejo)', distrito: 'Beja', regiao: 'Alentejo' },
  'alvito': { lat: 38.2575, lng: -7.9917, cidade: 'Alvito', distrito: 'Beja', regiao: 'Alentejo' },
  'ferreira do alentejo': { lat: 38.0583, lng: -8.1139, cidade: 'Ferreira do Alentejo', distrito: 'Beja', regiao: 'Alentejo' },
  'aljustrel': { lat: 37.8767, lng: -8.1639, cidade: 'Aljustrel', distrito: 'Beja', regiao: 'Alentejo' },
  'castro verde': { lat: 37.6989, lng: -8.0847, cidade: 'Castro Verde', distrito: 'Beja', regiao: 'Alentejo' },
  'mértola': { lat: 37.6406, lng: -7.6631, cidade: 'Mértola', distrito: 'Beja', regiao: 'Alentejo' },
  'mertola': { lat: 37.6406, lng: -7.6631, cidade: 'Mértola', distrito: 'Beja', regiao: 'Alentejo' },
  'almodovar': { lat: 37.5117, lng: -8.0617, cidade: 'Almodôvar', distrito: 'Beja', regiao: 'Alentejo' },
  'almodôvar': { lat: 37.5117, lng: -8.0617, cidade: 'Almodôvar', distrito: 'Beja', regiao: 'Alentejo' },
  'grandola': { lat: 38.1764, lng: -8.5678, cidade: 'Grândola', distrito: 'Setúbal', regiao: 'Alentejo' },
  'grândola': { lat: 38.1764, lng: -8.5678, cidade: 'Grândola', distrito: 'Setúbal', regiao: 'Alentejo' },
  'alcacer do sal': { lat: 38.3725, lng: -8.5139, cidade: 'Alcácer do Sal', distrito: 'Setúbal', regiao: 'Alentejo' },
  'alcácer do sal': { lat: 38.3725, lng: -8.5139, cidade: 'Alcácer do Sal', distrito: 'Setúbal', regiao: 'Alentejo' },
  'montemor-o-novo': { lat: 38.6467, lng: -8.2164, cidade: 'Montemor-o-Novo', distrito: 'Évora', regiao: 'Alentejo' },
  'vendas novas': { lat: 38.6797, lng: -8.4578, cidade: 'Vendas Novas', distrito: 'Évora', regiao: 'Alentejo' },
  'arraiolos': { lat: 38.7239, lng: -7.9847, cidade: 'Arraiolos', distrito: 'Évora', regiao: 'Alentejo' },
  'borba': { lat: 38.8056, lng: -7.4556, cidade: 'Borba', distrito: 'Évora', regiao: 'Alentejo' },
  'vila viçosa': { lat: 38.7817, lng: -7.4189, cidade: 'Vila Viçosa', distrito: 'Évora', regiao: 'Alentejo' },
  'vila vicosa': { lat: 38.7817, lng: -7.4189, cidade: 'Vila Viçosa', distrito: 'Évora', regiao: 'Alentejo' },
  'reguengos de monsaraz': { lat: 38.4247, lng: -7.5347, cidade: 'Reguengos de Monsaraz', distrito: 'Évora', regiao: 'Alentejo' },
  'portel': { lat: 38.3072, lng: -7.7039, cidade: 'Portel', distrito: 'Évora', regiao: 'Alentejo' },
  'ponte de sor': { lat: 39.2489, lng: -8.0125, cidade: 'Ponte de Sor', distrito: 'Portalegre', regiao: 'Alentejo' },
  'campo maior': { lat: 39.0139, lng: -7.0694, cidade: 'Campo Maior', distrito: 'Portalegre', regiao: 'Alentejo' },

  // --- ALGARVE & SUL ---
  'marina de vilamoura': { lat: 37.0765, lng: -8.1195, cidade: 'Vilamoura (Marina)', distrito: 'Faro', regiao: 'Algarve' },
  'vilamoura': { lat: 37.0789, lng: -8.1189, cidade: 'Vilamoura', distrito: 'Faro', regiao: 'Algarve' },
  'quarteira': { lat: 37.0694, lng: -8.1011, cidade: 'Quarteira', distrito: 'Faro', regiao: 'Algarve' },
  'almancil': { lat: 37.0869, lng: -8.0319, cidade: 'Almancil', distrito: 'Faro', regiao: 'Algarve' },
  'quinta do lago': { lat: 37.0514, lng: -8.0211, cidade: 'Quinta do Lago', distrito: 'Faro', regiao: 'Algarve' },
  'vale do lobo': { lat: 37.0536, lng: -8.0664, cidade: 'Vale do Lobo', distrito: 'Faro', regiao: 'Algarve' },
  'boliqueime': { lat: 37.1333, lng: -8.1500, cidade: 'Boliqueime', distrito: 'Faro', regiao: 'Algarve' },
  'albufeira': { lat: 37.0894, lng: -8.2469, cidade: 'Albufeira', distrito: 'Faro', regiao: 'Algarve' },
  'olhos de agua': { lat: 37.0917, lng: -8.1889, cidade: 'Olhos de Água', distrito: 'Faro', regiao: 'Algarve' },
  'olhos de água': { lat: 37.0917, lng: -8.1889, cidade: 'Olhos de Água', distrito: 'Faro', regiao: 'Algarve' },
  'ferreiras': { lat: 37.1306, lng: -8.2389, cidade: 'Ferreiras', distrito: 'Faro', regiao: 'Algarve' },
  'guia': { lat: 37.1306, lng: -8.3000, cidade: 'Guia (Albufeira)', distrito: 'Faro', regiao: 'Algarve' },
  'armacao de pera': { lat: 37.1025, lng: -8.3611, cidade: 'Armação de Pêra', distrito: 'Faro', regiao: 'Algarve' },
  'armação de pêra': { lat: 37.1025, lng: -8.3611, cidade: 'Armação de Pêra', distrito: 'Faro', regiao: 'Algarve' },
  'portimao': { lat: 37.1364, lng: -8.5378, cidade: 'Portimão', distrito: 'Faro', regiao: 'Algarve' },
  'portimão': { lat: 37.1364, lng: -8.5378, cidade: 'Portimão', distrito: 'Faro', regiao: 'Algarve' },
  'alvor': { lat: 37.1306, lng: -8.5917, cidade: 'Alvor', distrito: 'Faro', regiao: 'Algarve' },
  'ferragudo': { lat: 37.1264, lng: -8.5208, cidade: 'Ferragudo', distrito: 'Faro', regiao: 'Algarve' },
  'lagoa': { lat: 37.1347, lng: -8.4528, cidade: 'Lagoa', distrito: 'Faro', regiao: 'Algarve' },
  'carvoeiro': { lat: 37.0958, lng: -8.4708, cidade: 'Carvoeiro', distrito: 'Faro', regiao: 'Algarve' },
  'silves': { lat: 37.1889, lng: -8.4389, cidade: 'Silves', distrito: 'Faro', regiao: 'Algarve' },
  'monchique': { lat: 37.3175, lng: -8.5556, cidade: 'Monchique', distrito: 'Faro', regiao: 'Algarve' },
  'lagos': { lat: 37.1028, lng: -8.6731, cidade: 'Lagos', distrito: 'Faro', regiao: 'Algarve' },
  'praia da luz': { lat: 37.0861, lng: -8.7278, cidade: 'Praia da Luz', distrito: 'Faro', regiao: 'Algarve' },
  'sagres': { lat: 37.0086, lng: -8.9397, cidade: 'Sagres', distrito: 'Faro', regiao: 'Algarve' },
  'vila do bispo': { lat: 37.0817, lng: -8.9114, cidade: 'Vila do Bispo', distrito: 'Faro', regiao: 'Algarve' },
  'aljezur': { lat: 37.3189, lng: -8.8028, cidade: 'Aljezur', distrito: 'Faro', regiao: 'Algarve' },
  'loule': { lat: 37.1383, lng: -8.0225, cidade: 'Loulé', distrito: 'Faro', regiao: 'Algarve' },
  'loulé': { lat: 37.1383, lng: -8.0225, cidade: 'Loulé', distrito: 'Faro', regiao: 'Algarve' },
  'faro': { lat: 37.0194, lng: -7.9304, cidade: 'Faro', distrito: 'Faro', regiao: 'Algarve' },
  'aeroporto de faro': { lat: 37.0144, lng: -7.9659, cidade: 'Aeroporto de Faro', distrito: 'Faro', regiao: 'Algarve' },
  'sao bras de alportel': { lat: 37.1517, lng: -7.8864, cidade: 'São Brás de Alportel', distrito: 'Faro', regiao: 'Algarve' },
  'são brás de alportel': { lat: 37.1517, lng: -7.8864, cidade: 'São Brás de Alportel', distrito: 'Faro', regiao: 'Algarve' },
  'olhao': { lat: 37.0289, lng: -7.8411, cidade: 'Olhão', distrito: 'Faro', regiao: 'Algarve' },
  'olhão': { lat: 37.0289, lng: -7.8411, cidade: 'Olhão', distrito: 'Faro', regiao: 'Algarve' },
  'fuseta': { lat: 37.0542, lng: -7.7472, cidade: 'Fuseta', distrito: 'Faro', regiao: 'Algarve' },
  'tavira': { lat: 37.1264, lng: -7.6497, cidade: 'Tavira', distrito: 'Faro', regiao: 'Algarve' },
  'cabanas de tavira': { lat: 37.1350, lng: -7.5950, cidade: 'Cabanas de Tavira', distrito: 'Faro', regiao: 'Algarve' },
  'santa luzia': { lat: 37.1017, lng: -7.6617, cidade: 'Santa Luzia (Tavira)', distrito: 'Faro', regiao: 'Algarve' },
  'vila real de santo antonio': { lat: 37.1947, lng: -7.4172, cidade: 'Vila Real de Santo António', distrito: 'Faro', regiao: 'Algarve' },
  'vila real de santo antónio': { lat: 37.1947, lng: -7.4172, cidade: 'Vila Real de Santo António', distrito: 'Faro', regiao: 'Algarve' },
  'vrsa': { lat: 37.1947, lng: -7.4172, cidade: 'Vila Real de Santo António', distrito: 'Faro', regiao: 'Algarve' },
  'monte gordo': { lat: 37.1817, lng: -7.4528, cidade: 'Monte Gordo', distrito: 'Faro', regiao: 'Algarve' },
  'castro marim': { lat: 37.2181, lng: -7.4428, cidade: 'Castro Marim', distrito: 'Faro', regiao: 'Algarve' },
  'alcoutim': { lat: 37.4719, lng: -7.4719, cidade: 'Alcoutim', distrito: 'Faro', regiao: 'Algarve' },

  // --- DISTRITO DE AVEIRO & SEDE HP ---
  'albergaria-a-velha': { lat: 40.6922, lng: -8.4806, cidade: 'Albergaria-a-Velha', distrito: 'Aveiro', regiao: 'Centro' },
  'albergaria': { lat: 40.6922, lng: -8.4806, cidade: 'Albergaria-a-Velha', distrito: 'Aveiro', regiao: 'Centro' },
  'aveiro': { lat: 40.6405, lng: -8.6538, cidade: 'Aveiro', distrito: 'Aveiro', regiao: 'Centro' },
  'agueda': { lat: 40.5756, lng: -8.4489, cidade: 'Águeda', distrito: 'Aveiro', regiao: 'Centro' },
  'águeda': { lat: 40.5756, lng: -8.4489, cidade: 'Águeda', distrito: 'Aveiro', regiao: 'Centro' },
  'ilhavo': { lat: 40.6019, lng: -8.6689, cidade: 'Ílhavo', distrito: 'Aveiro', regiao: 'Centro' },
  'ílhavo': { lat: 40.6019, lng: -8.6689, cidade: 'Ílhavo', distrito: 'Aveiro', regiao: 'Centro' },
  'santa maria da feira': { lat: 40.9250, lng: -8.5422, cidade: 'Santa Maria da Feira', distrito: 'Aveiro', regiao: 'Norte' },
  'feira': { lat: 40.9250, lng: -8.5422, cidade: 'Santa Maria da Feira', distrito: 'Aveiro', regiao: 'Norte' },
  'ovar': { lat: 40.8586, lng: -8.6256, cidade: 'Ovar', distrito: 'Aveiro', regiao: 'Centro' },
  'sao joao da madeira': { lat: 40.9022, lng: -8.4906, cidade: 'São João da Madeira', distrito: 'Aveiro', regiao: 'Norte' },
  'são joão da madeira': { lat: 40.9022, lng: -8.4906, cidade: 'São João da Madeira', distrito: 'Aveiro', regiao: 'Norte' },
  'oliveira de azemeis': { lat: 40.8389, lng: -8.4764, cidade: 'Oliveira de Azeméis', distrito: 'Aveiro', regiao: 'Norte' },
  'oliveira de azeméis': { lat: 40.8389, lng: -8.4764, cidade: 'Oliveira de Azeméis', distrito: 'Aveiro', regiao: 'Norte' },
  'estarreja': { lat: 40.7547, lng: -8.5694, cidade: 'Estarreja', distrito: 'Aveiro', regiao: 'Centro' },
  'anadia': { lat: 40.4439, lng: -8.4347, cidade: 'Anadia', distrito: 'Aveiro', regiao: 'Centro' },
  'mealhada': { lat: 40.3789, lng: -8.4514, cidade: 'Mealhada', distrito: 'Aveiro', regiao: 'Centro' },
  'vagos': { lat: 40.5542, lng: -8.6811, cidade: 'Vagos', distrito: 'Aveiro', regiao: 'Centro' },
  'espinho': { lat: 41.0072, lng: -8.6417, cidade: 'Espinho', distrito: 'Aveiro', regiao: 'Norte' },
  'sever do vouga': { lat: 40.7333, lng: -8.3667, cidade: 'Sever do Vouga', distrito: 'Aveiro', regiao: 'Centro' },
  'murtosa': { lat: 40.7389, lng: -8.6361, cidade: 'Murtosa', distrito: 'Aveiro', regiao: 'Centro' },
  'vale de cambra': { lat: 40.8500, lng: -8.3833, cidade: 'Vale de Cambra', distrito: 'Aveiro', regiao: 'Norte' },

  // --- DISTRITO DO PORTO & GRANDE PORTO ---
  'porto': { lat: 41.1579, lng: -8.6291, cidade: 'Porto', distrito: 'Porto', regiao: 'Norte' },
  'maia': { lat: 41.2356, lng: -8.6214, cidade: 'Maia', distrito: 'Porto', regiao: 'Norte' },
  'aeroporto francisco sa carneiro': { lat: 41.2481, lng: -8.6814, cidade: 'Aeroporto Sá Carneiro (Maia)', distrito: 'Porto', regiao: 'Norte' },
  'matosinhos': { lat: 41.1822, lng: -8.6964, cidade: 'Matosinhos', distrito: 'Porto', regiao: 'Norte' },
  'leça da palmeira': { lat: 41.1917, lng: -8.6972, cidade: 'Leça da Palmeira', distrito: 'Porto', regiao: 'Norte' },
  'leca da palmeira': { lat: 41.1917, lng: -8.6972, cidade: 'Leça da Palmeira', distrito: 'Porto', regiao: 'Norte' },
  'porto de leixoes': { lat: 41.1889, lng: -8.7011, cidade: 'Porto de Leixões', distrito: 'Porto', regiao: 'Norte' },
  'leixoes': { lat: 41.1889, lng: -8.7011, cidade: 'Leixões', distrito: 'Porto', regiao: 'Norte' },
  'leixões': { lat: 41.1889, lng: -8.7011, cidade: 'Leixões', distrito: 'Porto', regiao: 'Norte' },
  'vila nova de gaia': { lat: 41.1239, lng: -8.6119, cidade: 'Vila Nova de Gaia', distrito: 'Porto', regiao: 'Norte' },
  'gaia': { lat: 41.1239, lng: -8.6119, cidade: 'Vila Nova de Gaia', distrito: 'Porto', regiao: 'Norte' },
  'canidelo': { lat: 41.1350, lng: -8.6500, cidade: 'Canidelo (Gaia)', distrito: 'Porto', regiao: 'Norte' },
  'vila do conde': { lat: 41.3547, lng: -8.7431, cidade: 'Vila do Conde', distrito: 'Porto', regiao: 'Norte' },
  'varziela': { lat: 41.3650, lng: -8.7180, cidade: 'Varziela (Vila do Conde)', distrito: 'Porto', regiao: 'Norte' },
  'povoa de varzim': { lat: 41.3833, lng: -8.7619, cidade: 'Póvoa de Varzim', distrito: 'Porto', regiao: 'Norte' },
  'póvoa de varzim': { lat: 41.3833, lng: -8.7619, cidade: 'Póvoa de Varzim', distrito: 'Porto', regiao: 'Norte' },
  'gondomar': { lat: 41.1444, lng: -8.5319, cidade: 'Gondomar', distrito: 'Porto', regiao: 'Norte' },
  'valongo': { lat: 41.1889, lng: -8.4989, cidade: 'Valongo', distrito: 'Porto', regiao: 'Norte' },
  'ermesinde': { lat: 41.2167, lng: -8.5500, cidade: 'Ermesinde', distrito: 'Porto', regiao: 'Norte' },
  'santo tirso': { lat: 41.3439, lng: -8.4739, cidade: 'Santo Tirso', distrito: 'Porto', regiao: 'Norte' },
  'trofa': { lat: 41.3389, lng: -8.5603, cidade: 'Trofa', distrito: 'Porto', regiao: 'Norte' },
  'penafiel': { lat: 41.2056, lng: -8.2831, cidade: 'Penafiel', distrito: 'Porto', regiao: 'Norte' },
  'paredes': { lat: 41.2069, lng: -8.3303, cidade: 'Paredes', distrito: 'Porto', regiao: 'Norte' },
  'pacos de ferreira': { lat: 41.2789, lng: -8.3844, cidade: 'Paços de Ferreira', distrito: 'Porto', regiao: 'Norte' },
  'paços de ferreira': { lat: 41.2789, lng: -8.3844, cidade: 'Paços de Ferreira', distrito: 'Porto', regiao: 'Norte' },
  'amarante': { lat: 41.2725, lng: -8.0825, cidade: 'Amarante', distrito: 'Porto', regiao: 'Norte' },
  'felgueiras': { lat: 41.3667, lng: -8.2000, cidade: 'Felgueiras', distrito: 'Porto', regiao: 'Norte' },
  'lousada': { lat: 41.2833, lng: -8.2833, cidade: 'Lousada', distrito: 'Porto', regiao: 'Norte' },
  'marco de canaveses': { lat: 41.1833, lng: -8.1500, cidade: 'Marco de Canaveses', distrito: 'Porto', regiao: 'Norte' },
  'baiao': { lat: 41.1667, lng: -8.0333, cidade: 'Baião', distrito: 'Porto', regiao: 'Norte' },

  // --- DISTRITO DE BRAGA & MINHO ---
  'braga': { lat: 41.5454, lng: -8.4265, cidade: 'Braga', distrito: 'Braga', regiao: 'Norte' },
  'guimaraes': { lat: 41.4425, lng: -8.2917, cidade: 'Guimarães', distrito: 'Braga', regiao: 'Norte' },
  'guimarães': { lat: 41.4425, lng: -8.2917, cidade: 'Guimarães', distrito: 'Braga', regiao: 'Norte' },
  'famalicao': { lat: 41.4078, lng: -8.5197, cidade: 'Vila Nova de Famalicão', distrito: 'Braga', regiao: 'Norte' },
  'famalicão': { lat: 41.4078, lng: -8.5197, cidade: 'Vila Nova de Famalicão', distrito: 'Braga', regiao: 'Norte' },
  'barcelos': { lat: 41.5317, lng: -8.6186, cidade: 'Barcelos', distrito: 'Braga', regiao: 'Norte' },
  'esposende': { lat: 41.5350, lng: -8.7806, cidade: 'Esposende', distrito: 'Braga', regiao: 'Norte' },
  'fafe': { lat: 41.4503, lng: -8.1736, cidade: 'Fafe', distrito: 'Braga', regiao: 'Norte' },
  'vizela': { lat: 41.3833, lng: -8.3167, cidade: 'Vizela', distrito: 'Braga', regiao: 'Norte' },
  'vila verde': { lat: 41.6489, lng: -8.4350, cidade: 'Vila Verde', distrito: 'Braga', regiao: 'Norte' },
  'amares': { lat: 41.6333, lng: -8.3500, cidade: 'Amares', distrito: 'Braga', regiao: 'Norte' },
  'povoa de lanhoso': { lat: 41.5833, lng: -8.2667, cidade: 'Póvoa de Lanhoso', distrito: 'Braga', regiao: 'Norte' },
  'vieira do minho': { lat: 41.6333, lng: -8.1333, cidade: 'Vieira do Minho', distrito: 'Braga', regiao: 'Norte' },

  // --- DISTRITO DE VIANA DO CASTELO ---
  'viana do castelo': { lat: 41.6932, lng: -8.8329, cidade: 'Viana do Castelo', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'ponte de lima': { lat: 41.7675, lng: -8.5833, cidade: 'Ponte de Lima', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'valenca': { lat: 42.0294, lng: -8.6444, cidade: 'Valença', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'valença': { lat: 42.0294, lng: -8.6444, cidade: 'Valença', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'caminha': { lat: 41.8756, lng: -8.8386, cidade: 'Caminha', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'vila nova de cerveira': { lat: 41.9400, lng: -8.7400, cidade: 'Vila Nova de Cerveira', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'moncao': { lat: 42.0789, lng: -8.4806, cidade: 'Monção', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'monção': { lat: 42.0789, lng: -8.4806, cidade: 'Monção', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'melgaco': { lat: 42.1144, lng: -8.2589, cidade: 'Melgaço', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'arcos de valdevez': { lat: 41.8469, lng: -8.4186, cidade: 'Arcos de Valdevez', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'ponte da barca': { lat: 41.8089, lng: -8.4206, cidade: 'Ponte da Barca', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'paredes de coura': { lat: 41.9122, lng: -8.5633, cidade: 'Paredes de Coura', distrito: 'Viana do Castelo', regiao: 'Norte' },

  // --- DISTRITO DE LISBOA & GRANDE LISBOA ---
  'lisboa': { lat: 38.7223, lng: -9.1393, cidade: 'Lisboa', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'parque das nacoes': { lat: 38.7686, lng: -9.0939, cidade: 'Parque das Nações (Lisboa)', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'parque das nações': { lat: 38.7686, lng: -9.0939, cidade: 'Parque das Nações (Lisboa)', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'sintra': { lat: 38.8029, lng: -9.3817, cidade: 'Sintra', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'cascais': { lat: 38.6979, lng: -9.4215, cidade: 'Cascais', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'estoril': { lat: 38.7056, lng: -9.3978, cidade: 'Estoril', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'carcavelos': { lat: 38.6833, lng: -9.3333, cidade: 'Carcavelos', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'loures': { lat: 38.8311, lng: -9.1683, cidade: 'Loures', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'oeiras': { lat: 38.6969, lng: -9.3106, cidade: 'Oeiras', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'amadora': { lat: 38.7594, lng: -9.2239, cidade: 'Amadora', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'odivelas': { lat: 38.7933, lng: -9.1836, cidade: 'Odivelas', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'vila franca de xira': { lat: 38.9553, lng: -8.9897, cidade: 'Vila Franca de Xira', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'alverca': { lat: 38.8986, lng: -9.0394, cidade: 'Alverca do Ribatejo', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'povoa de santa iria': { lat: 38.8617, lng: -9.0664, cidade: 'Póvoa de Santa Iria', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'torres vedras': { lat: 39.0919, lng: -9.2589, cidade: 'Torres Vedras', distrito: 'Lisboa', regiao: 'Centro' },
  'mafra': { lat: 38.9372, lng: -9.3267, cidade: 'Mafra', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'ericeira': { lat: 38.9633, lng: -9.4178, cidade: 'Ericeira', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'lourinha': { lat: 39.2417, lng: -9.3125, cidade: 'Lourinhã', distrito: 'Lisboa', regiao: 'Centro' },
  'lourinhã': { lat: 39.2417, lng: -9.3125, cidade: 'Lourinhã', distrito: 'Lisboa', regiao: 'Centro' },
  'arruda dos vinhos': { lat: 38.9833, lng: -9.0833, cidade: 'Arruda dos Vinhos', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'sobral de monte agraco': { lat: 39.0167, lng: -9.1500, cidade: 'Sobral de Monte Agraço', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },

  // --- DISTRITO DE COIMBRA ---
  'coimbra': { lat: 40.2033, lng: -8.4103, cidade: 'Coimbra', distrito: 'Coimbra', regiao: 'Centro' },
  'figueira da foz': { lat: 40.1508, lng: -8.8617, cidade: 'Figueira da Foz', distrito: 'Coimbra', regiao: 'Centro' },
  'cantanhede': { lat: 40.3464, lng: -8.5939, cidade: 'Cantanhede', distrito: 'Coimbra', regiao: 'Centro' },
  'montemor-o-velho': { lat: 40.1750, lng: -8.6833, cidade: 'Montemor-o-Velho', distrito: 'Coimbra', regiao: 'Centro' },
  'condeixa-a-nova': { lat: 40.1167, lng: -8.4989, cidade: 'Condeixa-a-Nova', distrito: 'Coimbra', regiao: 'Centro' },
  'lousa': { lat: 40.1167, lng: -8.2458, cidade: 'Lousã', distrito: 'Coimbra', regiao: 'Centro' },
  'lousã': { lat: 40.1167, lng: -8.2458, cidade: 'Lousã', distrito: 'Coimbra', regiao: 'Centro' },
  'oliveira do hospital': { lat: 40.3597, lng: -7.8619, cidade: 'Oliveira do Hospital', distrito: 'Coimbra', regiao: 'Centro' },
  'tábua': { lat: 40.3600, lng: -8.0289, cidade: 'Tábua', distrito: 'Coimbra', regiao: 'Centro' },
  'tabua': { lat: 40.3600, lng: -8.0289, cidade: 'Tábua', distrito: 'Coimbra', regiao: 'Centro' },
  'arganil': { lat: 40.2189, lng: -8.0544, cidade: 'Arganil', distrito: 'Coimbra', regiao: 'Centro' },
  'penacova': { lat: 40.2694, lng: -8.2831, cidade: 'Penacova', distrito: 'Coimbra', regiao: 'Centro' },
  'soure': { lat: 40.0583, lng: -8.6256, cidade: 'Soure', distrito: 'Coimbra', regiao: 'Centro' },
  'mira': { lat: 40.4286, lng: -8.7367, cidade: 'Mira', distrito: 'Coimbra', regiao: 'Centro' },

  // --- DISTRITO DE LEIRIA ---
  'leiria': { lat: 39.7438, lng: -8.8078, cidade: 'Leiria', distrito: 'Leiria', regiao: 'Centro' },
  'marinha grande': { lat: 39.7497, lng: -8.9328, cidade: 'Marinha Grande', distrito: 'Leiria', regiao: 'Centro' },
  'pombal': { lat: 39.9147, lng: -8.6278, cidade: 'Pombal', distrito: 'Leiria', regiao: 'Centro' },
  'caldas da rainha': { lat: 39.4039, lng: -9.1369, cidade: 'Caldas da Rainha', distrito: 'Leiria', regiao: 'Centro' },
  'alcobaca': { lat: 39.5528, lng: -8.9778, cidade: 'Alcobaça', distrito: 'Leiria', regiao: 'Centro' },
  'alcobaça': { lat: 39.5528, lng: -8.9778, cidade: 'Alcobaça', distrito: 'Leiria', regiao: 'Centro' },
  'peniche': { lat: 39.3558, lng: -9.3811, cidade: 'Peniche', distrito: 'Leiria', regiao: 'Centro' },
  'batalha': { lat: 39.6583, lng: -8.8239, cidade: 'Batalha', distrito: 'Leiria', regiao: 'Centro' },
  'porto de mos': { lat: 39.5989, lng: -8.8175, cidade: 'Porto de Mós', distrito: 'Leiria', regiao: 'Centro' },
  'porto de mós': { lat: 39.5989, lng: -8.8175, cidade: 'Porto de Mós', distrito: 'Leiria', regiao: 'Centro' },
  'fatima': { lat: 39.6172, lng: -8.6528, cidade: 'Fátima', distrito: 'Santarém', regiao: 'Centro' },
  'fátima': { lat: 39.6172, lng: -8.6528, cidade: 'Fátima', distrito: 'Santarém', regiao: 'Centro' },
  'nazare': { lat: 39.6019, lng: -9.0706, cidade: 'Nazaré', distrito: 'Leiria', regiao: 'Centro' },
  'nazaré': { lat: 39.6019, lng: -9.0706, cidade: 'Nazaré', distrito: 'Leiria', regiao: 'Centro' },
  'obidos': { lat: 39.3606, lng: -9.1572, cidade: 'Óbidos', distrito: 'Leiria', regiao: 'Centro' },
  'óbidos': { lat: 39.3606, lng: -9.1572, cidade: 'Óbidos', distrito: 'Leiria', regiao: 'Centro' },

  // --- DISTRITO DE SETÚBAL ---
  'setubal': { lat: 38.5244, lng: -8.8882, cidade: 'Setúbal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'setúbal': { lat: 38.5244, lng: -8.8882, cidade: 'Setúbal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'almada': { lat: 38.6792, lng: -9.1569, cidade: 'Almada', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'seixal': { lat: 38.6417, lng: -9.1039, cidade: 'Seixal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'barreiro': { lat: 38.6631, lng: -9.0725, cidade: 'Barreiro', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'moita': { lat: 38.6500, lng: -8.9833, cidade: 'Moita', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'palmela': { lat: 38.5683, lng: -8.9039, cidade: 'Palmela', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'montijo': { lat: 38.7067, lng: -8.9739, cidade: 'Montijo', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'alcochete': { lat: 38.7561, lng: -8.9619, cidade: 'Alcochete', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'sines': { lat: 37.9561, lng: -8.8697, cidade: 'Sines', distrito: 'Setúbal', regiao: 'Alentejo' },
  'santiago do cacem': { lat: 38.0167, lng: -8.6944, cidade: 'Santiago do Cacém', distrito: 'Setúbal', regiao: 'Alentejo' },
  'santiago do cacém': { lat: 38.0167, lng: -8.6944, cidade: 'Santiago do Cacém', distrito: 'Setúbal', regiao: 'Alentejo' },
  'sesimbra': { lat: 38.4444, lng: -9.1014, cidade: 'Sesimbra', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },

  // --- DISTRITO DE SANTARÉM ---
  'santarem': { lat: 39.2369, lng: -8.6853, cidade: 'Santarém', distrito: 'Santarém', regiao: 'Centro' },
  'santarém': { lat: 39.2369, lng: -8.6853, cidade: 'Santarém', distrito: 'Santarém', regiao: 'Centro' },
  'tomar': { lat: 39.6033, lng: -8.4078, cidade: 'Tomar', distrito: 'Santarém', regiao: 'Centro' },
  'abrantes': { lat: 39.4639, lng: -8.1983, cidade: 'Abrantes', distrito: 'Santarém', regiao: 'Centro' },
  'torres novas': { lat: 39.4797, lng: -8.5408, cidade: 'Torres Novas', distrito: 'Santarém', regiao: 'Centro' },
  'entroncamento': { lat: 39.4644, lng: -8.4686, cidade: 'Entroncamento', distrito: 'Santarém', regiao: 'Centro' },
  'rio maior': { lat: 39.3364, lng: -8.9358, cidade: 'Rio Maior', distrito: 'Santarém', regiao: 'Centro' },
  'benavente': { lat: 38.9806, lng: -8.8089, cidade: 'Benavente', distrito: 'Santarém', regiao: 'Centro' },
  'almeirim': { lat: 39.2089, lng: -8.6256, cidade: 'Almeirim', distrito: 'Santarém', regiao: 'Centro' },
  'cartaxo': { lat: 39.1608, lng: -8.7881, cidade: 'Cartaxo', distrito: 'Santarém', regiao: 'Centro' },
  'coruche': { lat: 38.9600, lng: -8.5256, cidade: 'Coruche', distrito: 'Santarém', regiao: 'Alentejo' },
  'salvaterra de magos': { lat: 39.0289, lng: -8.7933, cidade: 'Salvaterra de Magos', distrito: 'Santarém', regiao: 'Centro' },
  'ourem': { lat: 39.6417, lng: -8.5917, cidade: 'Ourém', distrito: 'Santarém', regiao: 'Centro' },
  'ourém': { lat: 39.6417, lng: -8.5917, cidade: 'Ourém', distrito: 'Santarém', regiao: 'Centro' },

  // --- DISTRITO DE VISEU ---
  'viseu': { lat: 40.6575, lng: -7.9142, cidade: 'Viseu', distrito: 'Viseu', regiao: 'Centro' },
  'lamego': { lat: 41.0967, lng: -7.8103, cidade: 'Lamego', distrito: 'Viseu', regiao: 'Norte' },
  'mangualde': { lat: 40.6067, lng: -7.7633, cidade: 'Mangualde', distrito: 'Viseu', regiao: 'Centro' },
  'tondela': { lat: 40.5167, lng: -8.0811, cidade: 'Tondela', distrito: 'Viseu', regiao: 'Centro' },
  'sao pedro do sul': { lat: 40.7600, lng: -8.0644, cidade: 'São Pedro do Sul', distrito: 'Viseu', regiao: 'Centro' },
  'são pedro do sul': { lat: 40.7600, lng: -8.0644, cidade: 'São Pedro do Sul', distrito: 'Viseu', regiao: 'Centro' },
  'castro daire': { lat: 40.9000, lng: -7.9333, cidade: 'Castro Daire', distrito: 'Viseu', regiao: 'Centro' },
  'santa comba dao': { lat: 40.3989, lng: -8.1311, cidade: 'Santa Comba Dão', distrito: 'Viseu', regiao: 'Centro' },
  'santa comba dão': { lat: 40.3989, lng: -8.1311, cidade: 'Santa Comba Dão', distrito: 'Viseu', regiao: 'Centro' },
  'nelas': { lat: 40.5333, lng: -7.8500, cidade: 'Nelas', distrito: 'Viseu', regiao: 'Centro' },
  'cinfaes': { lat: 41.0667, lng: -8.0833, cidade: 'Cinfães', distrito: 'Viseu', regiao: 'Norte' },
  'cinfães': { lat: 41.0667, lng: -8.0833, cidade: 'Cinfães', distrito: 'Viseu', regiao: 'Norte' },
  'resende': { lat: 41.1000, lng: -7.9667, cidade: 'Resende', distrito: 'Viseu', regiao: 'Norte' },

  // --- DISTRITO DE VILA REAL ---
  'vila real': { lat: 41.3006, lng: -7.7441, cidade: 'Vila Real', distrito: 'Vila Real', regiao: 'Norte' },
  'chaves': { lat: 41.7408, lng: -7.4725, cidade: 'Chaves', distrito: 'Vila Real', regiao: 'Norte' },
  'peso da regua': { lat: 41.1644, lng: -7.7889, cidade: 'Peso da Régua', distrito: 'Vila Real', regiao: 'Norte' },
  'peso da régua': { lat: 41.1644, lng: -7.7889, cidade: 'Peso da Régua', distrito: 'Vila Real', regiao: 'Norte' },
  'alijo': { lat: 41.2750, lng: -7.4750, cidade: 'Alijó', distrito: 'Vila Real', regiao: 'Norte' },
  'alijó': { lat: 41.2750, lng: -7.4750, cidade: 'Alijó', distrito: 'Vila Real', regiao: 'Norte' },
  'valpacos': { lat: 41.6067, lng: -7.3103, cidade: 'Valpaços', distrito: 'Vila Real', regiao: 'Norte' },
  'valpaços': { lat: 41.6067, lng: -7.3103, cidade: 'Valpaços', distrito: 'Vila Real', regiao: 'Norte' },
  'montalegre': { lat: 41.8239, lng: -7.7906, cidade: 'Montalegre', distrito: 'Vila Real', regiao: 'Norte' },
  'vila pouca de aguiar': { lat: 41.5000, lng: -7.6333, cidade: 'Vila Pouca de Aguiar', distrito: 'Vila Real', regiao: 'Norte' },

  // --- DISTRITO DE BRAGANÇA ---
  'braganca': { lat: 41.8058, lng: -6.7572, cidade: 'Bragança', distrito: 'Bragança', regiao: 'Norte' },
  'bragança': { lat: 41.8058, lng: -6.7572, cidade: 'Bragança', distrito: 'Bragança', regiao: 'Norte' },
  'mirandela': { lat: 41.4878, lng: -7.1856, cidade: 'Mirandela', distrito: 'Bragança', regiao: 'Norte' },
  'macedo de cavaleiros': { lat: 41.5367, lng: -6.9589, cidade: 'Macedo de Cavaleiros', distrito: 'Bragança', regiao: 'Norte' },
  'torre de moncorvo': { lat: 41.1750, lng: -7.0528, cidade: 'Torre de Moncorvo', distrito: 'Bragança', regiao: 'Norte' },
  'moncorvo': { lat: 41.1750, lng: -7.0528, cidade: 'Torre de Moncorvo', distrito: 'Bragança', regiao: 'Norte' },
  'vila nova de foz coa': { lat: 41.0833, lng: -7.1333, cidade: 'Vila Nova de Foz Côa', distrito: 'Guarda', regiao: 'Norte' },
  'foz coa': { lat: 41.0833, lng: -7.1333, cidade: 'Vila Nova de Foz Côa', distrito: 'Guarda', regiao: 'Norte' },
  'foz côa': { lat: 41.0833, lng: -7.1333, cidade: 'Vila Nova de Foz Côa', distrito: 'Guarda', regiao: 'Norte' },
  'freixo de espada a cinta': { lat: 41.0917, lng: -6.8083, cidade: 'Freixo de Espada à Cinta', distrito: 'Bragança', regiao: 'Norte' },
  'alfandega da fe': { lat: 41.3417, lng: -6.9639, cidade: 'Alfândega da Fé', distrito: 'Bragança', regiao: 'Norte' },
  'alfândega da fé': { lat: 41.3417, lng: -6.9639, cidade: 'Alfândega da Fé', distrito: 'Bragança', regiao: 'Norte' },
  'carrazeda de ansiaes': { lat: 41.2444, lng: -7.3056, cidade: 'Carrazeda de Ansiães', distrito: 'Bragança', regiao: 'Norte' },
  'carrazeda de ansiães': { lat: 41.2444, lng: -7.3056, cidade: 'Carrazeda de Ansiães', distrito: 'Bragança', regiao: 'Norte' },
  'mogadouro': { lat: 41.3406, lng: -6.7125, cidade: 'Mogadouro', distrito: 'Bragança', regiao: 'Norte' },
  'miranda do douro': { lat: 41.4939, lng: -6.2731, cidade: 'Miranda do Douro', distrito: 'Bragança', regiao: 'Norte' },
  'vinhais': { lat: 41.8344, lng: -7.0019, cidade: 'Vinhais', distrito: 'Bragança', regiao: 'Norte' },

  // --- DISTRITO DA GUARDA & CASTELO BRANCO ---
  'guarda': { lat: 40.5373, lng: -7.2658, cidade: 'Guarda', distrito: 'Guarda', regiao: 'Centro' },
  'seia': { lat: 40.4206, lng: -7.7042, cidade: 'Seia', distrito: 'Guarda', regiao: 'Centro' },
  'gouveia': { lat: 40.4947, lng: -7.5925, cidade: 'Gouveia', distrito: 'Guarda', regiao: 'Centro' },
  'pinhel': { lat: 40.7764, lng: -7.0622, cidade: 'Pinhel', distrito: 'Guarda', regiao: 'Centro' },
  'sabugal': { lat: 40.3528, lng: -7.0917, cidade: 'Sabugal', distrito: 'Guarda', regiao: 'Centro' },
  'trancoso': { lat: 40.7789, lng: -7.3489, cidade: 'Trancoso', distrito: 'Guarda', regiao: 'Centro' },
  'castelo branco': { lat: 39.8222, lng: -7.4931, cidade: 'Castelo Branco', distrito: 'Castelo Branco', regiao: 'Centro' },
  'covilha': { lat: 40.2828, lng: -7.5036, cidade: 'Covilhã', distrito: 'Castelo Branco', regiao: 'Centro' },
  'covilhã': { lat: 40.2828, lng: -7.5036, cidade: 'Covilhã', distrito: 'Castelo Branco', regiao: 'Centro' },
  'fundao': { lat: 40.1406, lng: -7.5011, cidade: 'Fundão', distrito: 'Castelo Branco', regiao: 'Centro' },
  'fundão': { lat: 40.1406, lng: -7.5011, cidade: 'Fundão', distrito: 'Castelo Branco', regiao: 'Centro' },
  'serta': { lat: 39.8028, lng: -8.0989, cidade: 'Sertã', distrito: 'Castelo Branco', regiao: 'Centro' },
  'sertã': { lat: 39.8028, lng: -8.0989, cidade: 'Sertã', distrito: 'Castelo Branco', regiao: 'Centro' },

  // --- DISTRITO DE ÉVORA, BEJA & PORTALEGRE (ALENTEJO) ---
  'evora': { lat: 38.5714, lng: -7.9135, cidade: 'Évora', distrito: 'Évora', regiao: 'Alentejo' },
  // --- ILHAS (MADEIRA & AÇORES) ---
  'funchal': { lat: 32.6500, lng: -16.9083, cidade: 'Funchal', distrito: 'Madeira', regiao: 'Madeira' },
  'madeira': { lat: 32.6500, lng: -16.9083, cidade: 'Madeira', distrito: 'Madeira', regiao: 'Madeira' },
  'ponta delgada': { lat: 37.7412, lng: -25.6756, cidade: 'Ponta Delgada', distrito: 'Açores', regiao: 'Açores' },
  'acores': { lat: 37.7412, lng: -25.6756, cidade: 'Açores', distrito: 'Açores', regiao: 'Açores' },
  'açores': { lat: 37.7412, lng: -25.6756, cidade: 'Açores', distrito: 'Açores', regiao: 'Açores' }
};

/**
 * Normalizes text to lowercase without accents or special characters
 */
function cleanSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape special regex characters in a search term
 */
function escapeRegExp(str: string): string {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Deterministic pseudo-random offset based on an identifier string
 */
function getJitterOffset(seedStr: string): { latOffset: number; lngOffset: number } {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const factor1 = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.012;
  const factor2 = ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * 0.012;
  return { latOffset: factor1, lngOffset: factor2 };
}

/**
 * Resolves GPS Coordinates from an Address, Company Name, Estaleiro, or City in Portugal
 */
export function resolvePortugalCoordinates(
  addressOrText: string,
  entityId: string = 'loc_default'
): LocationCoordinates {
  if (!addressOrText || addressOrText.trim().length === 0) {
    const jitter = getJitterOffset(entityId);
    return {
      lat: OFICINA_HP_BASE.lat + jitter.latOffset,
      lng: OFICINA_HP_BASE.lng + jitter.lngOffset,
      cidade: 'Albergaria-a-Velha',
      distrito: 'Aveiro',
      regiao: 'Centro'
    };
  }

  // 1. Direct Postal Code exact matching (e.g. 8125-409 -> 8125 -> Vilamoura/Quarteira)
  const cpMatch = addressOrText.match(/\b(\d{4})-\d{3}\b/) || addressOrText.match(/\b(\d{4})\b/);
  if (cpMatch) {
    const cpNum = parseInt(cpMatch[1], 10);
    if (PORTUGAL_POSTAL_CODES_EXACT[cpNum]) {
      const match = PORTUGAL_POSTAL_CODES_EXACT[cpNum];
      const jitter = getJitterOffset(entityId);
      return {
        lat: match.lat + jitter.latOffset,
        lng: match.lng + jitter.lngOffset,
        cidade: match.cidade,
        distrito: match.distrito,
        regiao: match.regiao
      };
    }
  }

  const rawClean = cleanSearchText(addressOrText);

  // 2. Direct city & landmark search with strict word boundaries, sorted by length descending
  // This guarantees that 'Marina de Vilamoura' or 'Vilamoura' matches Vilamoura before 'Moura'
  const sortedCityKeys = Object.keys(PORTUGAL_CITIES).sort((a, b) => b.length - a.length);

  for (const key of sortedCityKeys) {
    const cleanKey = cleanSearchText(key);
    // Strict boundary: match as standalone word/phrase
    const regex = new RegExp('(^|[^a-z0-9])' + escapeRegExp(cleanKey) + '([^a-z0-9]|$)', 'i');
    if (regex.test(rawClean)) {
      const coords = PORTUGAL_CITIES[key];
      const jitter = getJitterOffset(entityId);
      return {
        lat: coords.lat + jitter.latOffset,
        lng: coords.lng + jitter.lngOffset,
        cidade: coords.cidade,
        distrito: coords.distrito,
        regiao: coords.regiao
      };
    }
  }

  // 3. Fallback to Postal Code Prefix Ranges (if full postal code was given but wasn't in exact table)
  if (cpMatch) {
    const prefix = parseInt(cpMatch[1], 10);
    const jitter = getJitterOffset(entityId);
    if (prefix >= 1000 && prefix <= 1999) {
      return { lat: 38.7223 + jitter.latOffset, lng: -9.1393 + jitter.lngOffset, cidade: 'Lisboa', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' };
    }
    if (prefix >= 2000 && prefix <= 2399) {
      return { lat: 39.2369 + jitter.latOffset, lng: -8.6853 + jitter.lngOffset, cidade: 'Santarém', distrito: 'Santarém', regiao: 'Centro' };
    }
    if (prefix >= 2400 && prefix <= 2599) {
      return { lat: 39.7438 + jitter.latOffset, lng: -8.8078 + jitter.lngOffset, cidade: 'Leiria', distrito: 'Leiria', regiao: 'Centro' };
    }
    if (prefix >= 2600 && prefix <= 2799) {
      return { lat: 38.8029 + jitter.latOffset, lng: -9.3817 + jitter.lngOffset, cidade: 'Sintra / Loures', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' };
    }
    if (prefix >= 2800 && prefix <= 2999) {
      return { lat: 38.5244 + jitter.latOffset, lng: -8.8882 + jitter.lngOffset, cidade: 'Setúbal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' };
    }
    if (prefix >= 3000 && prefix <= 3399) {
      return { lat: 40.2033 + jitter.latOffset, lng: -8.4103 + jitter.lngOffset, cidade: 'Coimbra', distrito: 'Coimbra', regiao: 'Centro' };
    }
    if (prefix >= 3400 && prefix <= 3699) {
      return { lat: 40.6575 + jitter.latOffset, lng: -7.9142 + jitter.lngOffset, cidade: 'Viseu', distrito: 'Viseu', regiao: 'Centro' };
    }
    if (prefix >= 3700 && prefix <= 3899) {
      return { lat: 40.6922 + jitter.latOffset, lng: -8.4806 + jitter.lngOffset, cidade: 'Aveiro / Albergaria', distrito: 'Aveiro', regiao: 'Centro' };
    }
    if (prefix >= 4000 && prefix <= 4499) {
      return { lat: 41.1579 + jitter.latOffset, lng: -8.6291 + jitter.lngOffset, cidade: 'Porto', distrito: 'Porto', regiao: 'Norte' };
    }
    if (prefix >= 4500 && prefix <= 4699) {
      return { lat: 40.9250 + jitter.latOffset, lng: -8.5422 + jitter.lngOffset, cidade: 'Feira / Gaia', distrito: 'Porto / Aveiro', regiao: 'Norte' };
    }
    if (prefix >= 4700 && prefix <= 4899) {
      return { lat: 41.5454 + jitter.latOffset, lng: -8.4265 + jitter.lngOffset, cidade: 'Braga / Guimarães', distrito: 'Braga', regiao: 'Norte' };
    }
    if (prefix >= 4900 && prefix <= 4999) {
      return { lat: 41.6932 + jitter.latOffset, lng: -8.8329 + jitter.lngOffset, cidade: 'Viana do Castelo', distrito: 'Viana do Castelo', regiao: 'Norte' };
    }
    if (prefix >= 5000 && prefix <= 5499) {
      return { lat: 41.3006 + jitter.latOffset, lng: -7.7441 + jitter.lngOffset, cidade: 'Vila Real / Douro', distrito: 'Vila Real', regiao: 'Norte' };
    }
    if (prefix >= 6000 && prefix <= 6499) {
      return { lat: 40.5373 + jitter.latOffset, lng: -7.2658 + jitter.lngOffset, cidade: 'Guarda / C. Branco', distrito: 'Guarda', regiao: 'Centro' };
    }
    if (prefix >= 7000 && prefix <= 7999) {
      return { lat: 38.5714 + jitter.latOffset, lng: -7.9135 + jitter.lngOffset, cidade: 'Évora / Beja', distrito: 'Évora', regiao: 'Alentejo' };
    }
    if (prefix >= 8000 && prefix <= 8999) {
      return { lat: 37.0789 + jitter.latOffset, lng: -8.1189 + jitter.lngOffset, cidade: 'Faro / Algarve', distrito: 'Faro', regiao: 'Algarve' };
    }
  }

  // 4. Fallback: Albergaria-a-Velha Base
  const jitter = getJitterOffset(entityId);
  return {
    lat: OFICINA_HP_BASE.lat + jitter.latOffset,
    lng: OFICINA_HP_BASE.lng + jitter.lngOffset,
    cidade: 'Portugal (Geral)',
    distrito: 'Aveiro',
    regiao: 'Centro'
  };
}

/**
 * Calculates straight line and estimated driving distance in km between two GPS coordinates
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const airKm = R * c;
  
  // Real-world road driving distance estimate in Portugal (~1.2x straight line for typical highways/national roads)
  if (airKm < 5) return Math.round(airKm);
  return Math.round(airKm * 1.2);
}
