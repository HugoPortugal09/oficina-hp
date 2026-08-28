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

// Database of Portuguese Municipalities & Key Industrial Hubs
const PORTUGAL_CITIES: Record<string, LocationCoordinates> = {
  // Distrito de Aveiro
  'albergaria-a-velha': { lat: 40.6922, lng: -8.4806, cidade: 'Albergaria-a-Velha', distrito: 'Aveiro', regiao: 'Centro' },
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

  // Distrito do Porto & Grande Porto
  'porto': { lat: 41.1579, lng: -8.6291, cidade: 'Porto', distrito: 'Porto', regiao: 'Norte' },
  'maia': { lat: 41.2356, lng: -8.6214, cidade: 'Maia', distrito: 'Porto', regiao: 'Norte' },
  'matosinhos': { lat: 41.1822, lng: -8.6964, cidade: 'Matosinhos', distrito: 'Porto', regiao: 'Norte' },
  'leixoes': { lat: 41.1889, lng: -8.7011, cidade: 'Leixões', distrito: 'Porto', regiao: 'Norte' },
  'leixões': { lat: 41.1889, lng: -8.7011, cidade: 'Leixões', distrito: 'Porto', regiao: 'Norte' },
  'gaia': { lat: 41.1239, lng: -8.6119, cidade: 'Vila Nova de Gaia', distrito: 'Porto', regiao: 'Norte' },
  'vila nova de gaia': { lat: 41.1239, lng: -8.6119, cidade: 'Vila Nova de Gaia', distrito: 'Porto', regiao: 'Norte' },
  'canidelo': { lat: 41.1350, lng: -8.6500, cidade: 'Canidelo (Gaia)', distrito: 'Porto', regiao: 'Norte' },
  'vila do conde': { lat: 41.3547, lng: -8.7431, cidade: 'Vila do Conde', distrito: 'Porto', regiao: 'Norte' },
  'varziela': { lat: 41.3650, lng: -8.7180, cidade: 'Varziela (Vila do Conde)', distrito: 'Porto', regiao: 'Norte' },
  'povoa de varzim': { lat: 41.3833, lng: -8.7619, cidade: 'Póvoa de Varzim', distrito: 'Porto', regiao: 'Norte' },
  'póvoa de varzim': { lat: 41.3833, lng: -8.7619, cidade: 'Póvoa de Varzim', distrito: 'Porto', regiao: 'Norte' },
  'gondomar': { lat: 41.1444, lng: -8.5319, cidade: 'Gondomar', distrito: 'Porto', regiao: 'Norte' },
  'valongo': { lat: 41.1889, lng: -8.4989, cidade: 'Valongo', distrito: 'Porto', regiao: 'Norte' },
  'santo tirso': { lat: 41.3439, lng: -8.4739, cidade: 'Santo Tirso', distrito: 'Porto', regiao: 'Norte' },
  'trofa': { lat: 41.3389, lng: -8.5603, cidade: 'Trofa', distrito: 'Porto', regiao: 'Norte' },
  'penafiel': { lat: 41.2056, lng: -8.2831, cidade: 'Penafiel', distrito: 'Porto', regiao: 'Norte' },
  'paredes': { lat: 41.2069, lng: -8.3303, cidade: 'Paredes', distrito: 'Porto', regiao: 'Norte' },
  'amarante': { lat: 41.2725, lng: -8.0825, cidade: 'Amarante', distrito: 'Porto', regiao: 'Norte' },

  // Distrito de Braga
  'braga': { lat: 41.5454, lng: -8.4265, cidade: 'Braga', distrito: 'Braga', regiao: 'Norte' },
  'guimaraes': { lat: 41.4425, lng: -8.2917, cidade: 'Guimarães', distrito: 'Braga', regiao: 'Norte' },
  'guimarães': { lat: 41.4425, lng: -8.2917, cidade: 'Guimarães', distrito: 'Braga', regiao: 'Norte' },
  'famalicao': { lat: 41.4078, lng: -8.5197, cidade: 'Vila Nova de Famalicão', distrito: 'Braga', regiao: 'Norte' },
  'famalicão': { lat: 41.4078, lng: -8.5197, cidade: 'Vila Nova de Famalicão', distrito: 'Braga', regiao: 'Norte' },
  'barcelos': { lat: 41.5317, lng: -8.6186, cidade: 'Barcelos', distrito: 'Braga', regiao: 'Norte' },
  'esposende': { lat: 41.5350, lng: -8.7806, cidade: 'Esposende', distrito: 'Braga', regiao: 'Norte' },
  'fafe': { lat: 41.4503, lng: -8.1736, cidade: 'Fafe', distrito: 'Braga', regiao: 'Norte' },
  'vila verde': { lat: 41.6489, lng: -8.4350, cidade: 'Vila Verde', distrito: 'Braga', regiao: 'Norte' },

  // Distrito de Lisboa
  'lisboa': { lat: 38.7223, lng: -9.1393, cidade: 'Lisboa', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'sintra': { lat: 38.8029, lng: -9.3817, cidade: 'Sintra', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'cascais': { lat: 38.6979, lng: -9.4215, cidade: 'Cascais', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'loures': { lat: 38.8311, lng: -9.1683, cidade: 'Loures', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'oeiras': { lat: 38.6969, lng: -9.3106, cidade: 'Oeiras', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'amadora': { lat: 38.7594, lng: -9.2239, cidade: 'Amadora', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'odivelas': { lat: 38.7933, lng: -9.1836, cidade: 'Odivelas', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'vila franca de xira': { lat: 38.9553, lng: -8.9897, cidade: 'Vila Franca de Xira', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'torres vedras': { lat: 39.0919, lng: -9.2589, cidade: 'Torres Vedras', distrito: 'Lisboa', regiao: 'Centro' },
  'mafra': { lat: 38.9372, lng: -9.3267, cidade: 'Mafra', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },
  'alverca': { lat: 38.8986, lng: -9.0394, cidade: 'Alverca do Ribatejo', distrito: 'Lisboa', regiao: 'Lisboa & V.T.' },

  // Distrito de Coimbra
  'coimbra': { lat: 40.2033, lng: -8.4103, cidade: 'Coimbra', distrito: 'Coimbra', regiao: 'Centro' },
  'figueira da foz': { lat: 40.1508, lng: -8.8617, cidade: 'Figueira da Foz', distrito: 'Coimbra', regiao: 'Centro' },
  'cantanhede': { lat: 40.3464, lng: -8.5939, cidade: 'Cantanhede', distrito: 'Coimbra', regiao: 'Centro' },
  'montemor-o-velho': { lat: 40.1750, lng: -8.6833, cidade: 'Montemor-o-Velho', distrito: 'Coimbra', regiao: 'Centro' },
  'condeixa-a-nova': { lat: 40.1167, lng: -8.4989, cidade: 'Condeixa-a-Nova', distrito: 'Coimbra', regiao: 'Centro' },
  'lousa': { lat: 40.1167, lng: -8.2458, cidade: 'Lousã', distrito: 'Coimbra', regiao: 'Centro' },
  'lousã': { lat: 40.1167, lng: -8.2458, cidade: 'Lousã', distrito: 'Coimbra', regiao: 'Centro' },
  'oliveira do hospital': { lat: 40.3597, lng: -7.8619, cidade: 'Oliveira do Hospital', distrito: 'Coimbra', regiao: 'Centro' },

  // Distrito de Leiria
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

  // Distrito de Setúbal
  'setubal': { lat: 38.5244, lng: -8.8882, cidade: 'Setúbal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'setúbal': { lat: 38.5244, lng: -8.8882, cidade: 'Setúbal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'almada': { lat: 38.6792, lng: -9.1569, cidade: 'Almada', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'seixal': { lat: 38.6417, lng: -9.1039, cidade: 'Seixal', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'barreiro': { lat: 38.6631, lng: -9.0725, cidade: 'Barreiro', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'palmela': { lat: 38.5683, lng: -8.9039, cidade: 'Palmela', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'montijo': { lat: 38.7067, lng: -8.9739, cidade: 'Montijo', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },
  'sines': { lat: 37.9561, lng: -8.8697, cidade: 'Sines', distrito: 'Setúbal', regiao: 'Alentejo' },
  'sesimbra': { lat: 38.4444, lng: -9.1014, cidade: 'Sesimbra', distrito: 'Setúbal', regiao: 'Lisboa & V.T.' },

  // Distrito de Santarém
  'santarem': { lat: 39.2369, lng: -8.6853, cidade: 'Santarém', distrito: 'Santarém', regiao: 'Centro' },
  'santarém': { lat: 39.2369, lng: -8.6853, cidade: 'Santarém', distrito: 'Santarém', regiao: 'Centro' },
  'tomar': { lat: 39.6033, lng: -8.4078, cidade: 'Tomar', distrito: 'Santarém', regiao: 'Centro' },
  'abrantes': { lat: 39.4639, lng: -8.1983, cidade: 'Abrantes', distrito: 'Santarém', regiao: 'Centro' },
  'torres novas': { lat: 39.4797, lng: -8.5408, cidade: 'Torres Novas', distrito: 'Santarém', regiao: 'Centro' },
  'entroncamento': { lat: 39.4644, lng: -8.4686, cidade: 'Entroncamento', distrito: 'Santarém', regiao: 'Centro' },
  'rio maior': { lat: 39.3364, lng: -8.9358, cidade: 'Rio Maior', distrito: 'Santarém', regiao: 'Centro' },
  'benavente': { lat: 38.9806, lng: -8.8089, cidade: 'Benavente', distrito: 'Santarém', regiao: 'Centro' },

  // Distrito de Viseu
  'viseu': { lat: 40.6575, lng: -7.9142, cidade: 'Viseu', distrito: 'Viseu', regiao: 'Centro' },
  'lamego': { lat: 41.0967, lng: -7.8103, cidade: 'Lamego', distrito: 'Viseu', regiao: 'Norte' },
  'mangualde': { lat: 40.6067, lng: -7.7633, cidade: 'Mangualde', distrito: 'Viseu', regiao: 'Centro' },
  'tondela': { lat: 40.5167, lng: -8.0811, cidade: 'Tondela', distrito: 'Viseu', regiao: 'Centro' },
  'sao pedro do sul': { lat: 40.7600, lng: -8.0644, cidade: 'São Pedro do Sul', distrito: 'Viseu', regiao: 'Centro' },

  // Distrito de Viana do Castelo
  'viana do castelo': { lat: 41.6932, lng: -8.8329, cidade: 'Viana do Castelo', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'ponte de lima': { lat: 41.7675, lng: -8.5833, cidade: 'Ponte de Lima', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'valenca': { lat: 42.0294, lng: -8.6444, cidade: 'Valença', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'valença': { lat: 42.0294, lng: -8.6444, cidade: 'Valença', distrito: 'Viana do Castelo', regiao: 'Norte' },
  'caminha': { lat: 41.8756, lng: -8.8386, cidade: 'Caminha', distrito: 'Viana do Castelo', regiao: 'Norte' },

  // Distrito de Vila Real
  'vila real': { lat: 41.3006, lng: -7.7441, cidade: 'Vila Real', distrito: 'Vila Real', regiao: 'Norte' },
  'chaves': { lat: 41.7408, lng: -7.4725, cidade: 'Chaves', distrito: 'Vila Real', regiao: 'Norte' },
  'peso da regua': { lat: 41.1644, lng: -7.7889, cidade: 'Peso da Régua', distrito: 'Vila Real', regiao: 'Norte' },
  'peso da régua': { lat: 41.1644, lng: -7.7889, cidade: 'Peso da Régua', distrito: 'Vila Real', regiao: 'Norte' },

  // Distrito de Bragança
  'braganca': { lat: 41.8058, lng: -6.7572, cidade: 'Bragança', distrito: 'Bragança', regiao: 'Norte' },
  'bragança': { lat: 41.8058, lng: -6.7572, cidade: 'Bragança', distrito: 'Bragança', regiao: 'Norte' },
  'mirandela': { lat: 41.4878, lng: -7.1856, cidade: 'Mirandela', distrito: 'Bragança', regiao: 'Norte' },
  'macedo de cavaleiros': { lat: 41.5367, lng: -6.9589, cidade: 'Macedo de Cavaleiros', distrito: 'Bragança', regiao: 'Norte' },

  // Distrito da Guarda
  'guarda': { lat: 40.5373, lng: -7.2658, cidade: 'Guarda', distrito: 'Guarda', regiao: 'Centro' },
  'seia': { lat: 40.4206, lng: -7.7042, cidade: 'Seia', distrito: 'Guarda', regiao: 'Centro' },
  'gouveia': { lat: 40.4947, lng: -7.5925, cidade: 'Gouveia', distrito: 'Guarda', regiao: 'Centro' },
  'pinhel': { lat: 40.7764, lng: -7.0622, cidade: 'Pinhel', distrito: 'Guarda', regiao: 'Centro' },

  // Distrito de Castelo Branco
  'castelo branco': { lat: 39.8222, lng: -7.4931, cidade: 'Castelo Branco', distrito: 'Castelo Branco', regiao: 'Centro' },
  'covilha': { lat: 40.2828, lng: -7.5036, cidade: 'Covilhã', distrito: 'Castelo Branco', regiao: 'Centro' },
  'covilhã': { lat: 40.2828, lng: -7.5036, cidade: 'Covilhã', distrito: 'Castelo Branco', regiao: 'Centro' },
  'fundao': { lat: 40.1406, lng: -7.5011, cidade: 'Fundão', distrito: 'Castelo Branco', regiao: 'Centro' },
  'fundão': { lat: 40.1406, lng: -7.5011, cidade: 'Fundão', distrito: 'Castelo Branco', regiao: 'Centro' },

  // Distrito de Évora
  'evora': { lat: 38.5714, lng: -7.9135, cidade: 'Évora', distrito: 'Évora', regiao: 'Alentejo' },
  'évora': { lat: 38.5714, lng: -7.9135, cidade: 'Évora', distrito: 'Évora', regiao: 'Alentejo' },
  'montemor-o-novo': { lat: 38.6472, lng: -8.2144, cidade: 'Montemor-o-Novo', distrito: 'Évora', regiao: 'Alentejo' },
  'estremos': { lat: 38.8417, lng: -7.5878, cidade: 'Estremoz', distrito: 'Évora', regiao: 'Alentejo' },
  'estremoz': { lat: 38.8417, lng: -7.5878, cidade: 'Estremoz', distrito: 'Évora', regiao: 'Alentejo' },

  // Distrito de Beja
  'beja': { lat: 38.0150, lng: -7.8653, cidade: 'Beja', distrito: 'Beja', regiao: 'Alentejo' },
  'moura': { lat: 38.1408, lng: -7.4497, cidade: 'Moura', distrito: 'Beja', regiao: 'Alentejo' },
  'odemira': { lat: 37.5975, lng: -8.6419, cidade: 'Odemira', distrito: 'Beja', regiao: 'Alentejo' },
  'castro verde': { lat: 37.6989, lng: -8.0853, cidade: 'Castro Verde', distrito: 'Beja', regiao: 'Alentejo' },

  // Distrito de Portalegre
  'portalegre': { lat: 39.2936, lng: -7.4311, cidade: 'Portalegre', distrito: 'Portalegre', regiao: 'Alentejo' },
  'elvas': { lat: 38.8817, lng: -7.1628, cidade: 'Elvas', distrito: 'Portalegre', regiao: 'Alentejo' },
  'ponte de sor': { lat: 39.2489, lng: -8.0125, cidade: 'Ponte de Sor', distrito: 'Portalegre', regiao: 'Alentejo' },

  // Distrito de Faro (Algarve)
  'faro': { lat: 37.0194, lng: -7.9304, cidade: 'Faro', distrito: 'Faro', regiao: 'Algarve' },
  'portimao': { lat: 37.1364, lng: -8.5378, cidade: 'Portimão', distrito: 'Faro', regiao: 'Algarve' },
  'portimão': { lat: 37.1364, lng: -8.5378, cidade: 'Portimão', distrito: 'Faro', regiao: 'Algarve' },
  'loule': { lat: 37.1383, lng: -8.0225, cidade: 'Loulé', distrito: 'Faro', regiao: 'Algarve' },
  'loulé': { lat: 37.1383, lng: -8.0225, cidade: 'Loulé', distrito: 'Faro', regiao: 'Algarve' },
  'albufeira': { lat: 37.0894, lng: -8.2469, cidade: 'Albufeira', distrito: 'Faro', regiao: 'Algarve' },
  'lagos': { lat: 37.1028, lng: -8.6731, cidade: 'Lagos', distrito: 'Faro', regiao: 'Algarve' },
  'tavira': { lat: 37.1264, lng: -7.6497, cidade: 'Tavira', distrito: 'Faro', regiao: 'Algarve' },
  'olhao': { lat: 37.0289, lng: -7.8411, cidade: 'Olhão', distrito: 'Faro', regiao: 'Algarve' },
  'olhão': { lat: 37.0289, lng: -7.8411, cidade: 'Olhão', distrito: 'Faro', regiao: 'Algarve' },
  'silves': { lat: 37.1889, lng: -8.4389, cidade: 'Silves', distrito: 'Faro', regiao: 'Algarve' },

  // Ilhas (Madeira & Açores)
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
    .trim();
}

/**
 * Deterministic pseudo-random offset based on an identifier string
 * Prevents multiple pins on the same city from exactly stacking on top of each other.
 */
function getJitterOffset(seedStr: string): { latOffset: number; lngOffset: number } {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const factor1 = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.018;
  const factor2 = ((Math.abs(hash * 31) % 1000) / 1000 - 0.5) * 0.018;
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

  const rawClean = cleanSearchText(addressOrText);

  // 1. Direct city key search
  for (const [key, coords] of Object.entries(PORTUGAL_CITIES)) {
    const cleanKey = cleanSearchText(key);
    const regex = new RegExp(`\\b${cleanKey}\\b`, 'i');
    if (regex.test(rawClean) || rawClean.includes(cleanKey)) {
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

  // 2. Postal code prefix matching
  const cpMatch = addressOrText.match(/(\d{4})-\d{3}/);
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
      return { lat: 37.0194 + jitter.latOffset, lng: -7.9304 + jitter.lngOffset, cidade: 'Faro / Algarve', distrito: 'Faro', regiao: 'Algarve' };
    }
  }

  // Fallback: Centro / Albergaria-a-Velha Base
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
 * Calculates straight line distance in km between two GPS coordinates
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
  return Math.round(R * c);
}
