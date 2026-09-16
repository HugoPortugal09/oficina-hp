// Service for Road Distance Calculation and Navigation from GRAUMP (Albergaria-a-Velha)
import { db, STORAGE_KEYS } from './dbService';

export const GRAUMP_ORIGIN = 'Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha';
export const GRAUMP_COORDS = { lat: 40.6908, lon: -8.4808 };

// Client-side quick heuristic for Portuguese municipalities from Albergaria-a-Velha
export function estimateDistanceKm(address?: string): number {
  if (!address) return 45;
  const a = address.toLowerCase();

  // Aveiro / Baixo Vouga
  if (a.includes('albergaria')) return 5;
  if (a.includes('sever do vouga') || a.includes('sever')) return 18;
  if (a.includes('estarreja') || a.includes('murtosa')) return 22;
  if (a.includes('águeda') || a.includes('agueda')) return 16;
  if (a.includes('aveiro') || a.includes('íhavo') || a.includes('ilhavo') || a.includes('glicínias')) return 28;
  if (a.includes('vagos') || a.includes('mira')) return 35;
  if (a.includes('oliveira de azeméis') || a.includes('azemeis') || a.includes('cucujães')) return 22;
  if (a.includes('são joão da madeira') || a.includes('sao joao da madeira')) return 28;
  if (a.includes('vale de cambra')) return 25;
  if (a.includes('arouca')) return 45;
  if (a.includes('ovar') || a.includes('esmoriz') || a.includes('furadouro')) return 38;
  if (a.includes('santa maria da feira') || a.includes('feira') || a.includes('lourosa') || a.includes('fiães')) return 36;
  if (a.includes('espinho')) return 45;
  if (a.includes('anadia') || a.includes('sangalhos') || a.includes('curia')) return 32;
  if (a.includes('mealhada') || a.includes('luso')) return 42;

  // Grande Porto / Douro Litoral
  if (a.includes('leça do balio') || a.includes('lionesa') || a.includes('balio')) return 69.4;
  if (a.includes('gaia') || a.includes('vila nova de gaia') || a.includes('canidelo') || a.includes('coimbrões')) return 58;
  if (a.includes('porto') || a.includes('boavista') || a.includes('paranhos') || a.includes('campanhã') || a.includes('ramalde')) return 65;
  if (a.includes('matosinhos') || a.includes('leça da palmeira') || a.includes('leixões') || a.includes('senhora da hora') || a.includes('s. mamede')) return 72;
  if (a.includes('maia') || a.includes('águas santas') || a.includes('moreira') || a.includes('castelo da maia')) return 75;
  if (a.includes('gondomar') || a.includes('rio tinto') || a.includes('valbom')) return 64;
  if (a.includes('valongo') || a.includes('ermesinde')) return 72;
  if (a.includes('vila do conde')) return 85;
  if (a.includes('póvoa de varzim') || a.includes('povoa de varzim')) return 92;
  if (a.includes('santo tirso') || a.includes('trofa')) return 82;
  if (a.includes('penafiel') || a.includes('paredes') || a.includes('felgueiras') || a.includes('amarante')) return 85;

  // Centro / Coimbra / Viseu
  if (a.includes('cantanhede') || a.includes('tocha')) return 48;
  if (a.includes('coimbra') || a.includes('taveiro') || a.includes('ecoplasma')) return 58;
  if (a.includes('figueira da foz') || a.includes('lavos')) return 68;
  if (a.includes('condeixa') || a.includes('pombal')) return 75;
  if (a.includes('leiria') || a.includes('marinha grande') || a.includes('batalha') || a.includes('fátima') || a.includes('fatima')) return 98;
  if (a.includes('alcobaça') || a.includes('caldas da rainha') || a.includes('rio maior')) return 145;
  if (a.includes('viseu') || a.includes('mangualde')) return 68;
  if (a.includes('são pedro do sul') || a.includes('vouzelo') || a.includes('oliveira de frades')) return 38;
  if (a.includes('tondela') || a.includes('santa comba dão')) return 55;
  if (a.includes('castelo branco') || a.includes('covilhã') || a.includes('guarda')) return 165;

  // Minho / Norte
  if (a.includes('famalicão') || a.includes('famalicao')) return 88;
  if (a.includes('guimarães') || a.includes('guimaraes')) return 95;
  if (a.includes('braga')) return 105;
  if (a.includes('barcelos')) return 110;
  if (a.includes('viana do castelo') || a.includes('ponte de lima')) return 135;
  if (a.includes('vila real') || a.includes('chaves') || a.includes('bragança')) return 160;

  // Sul / Lisboa / Alentejo / Algarve
  if (a.includes('santarém') || a.includes('santarem') || a.includes('torres novas') || a.includes('entroncamento') || a.includes('tomar')) return 155;
  if (a.includes('lisboa') || a.includes('loures') || a.includes('amadora') || a.includes('odivelas') || a.includes('oeiras') || a.includes('sintra') || a.includes('cascais')) return 248;
  if (a.includes('setúbal') || a.includes('setubal') || a.includes('almada') || a.includes('seixal') || a.includes('barreiro') || a.includes('palmela')) return 278;
  if (a.includes('évora') || a.includes('evora') || a.includes('beja')) return 320;
  if (a.includes('faro') || a.includes('albufeira') || a.includes('portimão') || a.includes('loulé') || a.includes('lagos') || a.includes('algarve')) return 510;

  return 45;
}

// Online OpenStreetMap / OSRM Real Road Distance from GRAUMP (with timeout and caching)
const distanceCache = new Map<string, number>();

export async function fetchRoadDistanceKm(address: string): Promise<number | null> {
  if (!address || address.trim().length < 4) return null;
  const cleanAddr = address.trim();
  
  if (distanceCache.has(cleanAddr)) {
    return distanceCache.get(cleanAddr)!;
  }

  try {
    // 1. Geocode destination address with OpenStreetMap Nominatim
    const searchTerms = `${cleanAddr}, Portugal`;
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTerms)}&format=json&limit=1`;
    
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'OficinaHP-DistanceCalculator/1.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    if (!geoData || geoData.length === 0 || !geoData[0].lat || !geoData[0].lon) {
      return null;
    }

    const destLat = geoData[0].lat;
    const destLon = geoData[0].lon;

    // 2. Fetch driving road distance from GRAUMP coordinates (-8.4808, 40.6908) via OSRM
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${GRAUMP_COORDS.lon},${GRAUMP_COORDS.lat};${destLon},${destLat}?overview=false`;
    const routeRes = await fetch(osrmUrl, {
      signal: AbortSignal.timeout(5000)
    });

    if (!routeRes.ok) return null;
    const routeData = await routeRes.json();
    
    if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
      const distanceMeters = routeData.routes[0].distance;
      const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10; // 1 decimal place (e.g. 69.4)
      distanceCache.set(cleanAddr, distanceKm);
      return distanceKm;
    }
  } catch (err) {
    console.warn('[DistanceService] Online calculation failed, using heuristic:', err);
  }

  return null;
}

export function getGoogleMapsDirectionsUrl(destinationAddress: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(GRAUMP_ORIGIN)}&destination=${encodeURIComponent(destinationAddress)}`;
}

export function getWazeDirectionsUrl(destinationAddress: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(destinationAddress)}&navigate=yes`;
}
