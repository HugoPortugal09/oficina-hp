import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapPin,
  Search,
  Wrench,
  Navigation,
  Phone,
  ExternalLink,
  Car,
  Building2,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Compass,
  AlertCircle,
  Printer,
  Download,
  Loader2
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import html2canvas from 'html2canvas';
import { Badge } from '../components/Badge';
import {
  resolvePortugalCoordinates,
  calculateDistanceKm,
  OFICINA_HP_BASE,
  LocationCoordinates
} from '../services/portugalGeoService';
import { sortByDateDesc, formatDate, getTodayFormatted } from '../utils/dateUtils';
import { generateMapaServicosA3PDF } from '../services/pdfService';
import type { FolhaServico, Empresa, Cliente, Equipamento } from '../types';

interface MapaPortugalProps {
  folhas: FolhaServico[];
  empresas: Empresa[];
  clientes: Cliente[];
  equipamentos: Equipamento[];
  onSelectFolha: (fs: FolhaServico) => void;
  theme?: 'dark' | 'light';
}

interface MapMarkerItem {
  folha: FolhaServico;
  empresa?: Empresa;
  cliente?: Cliente;
  equipamento?: Equipamento;
  coords: LocationCoordinates;
  distanciaKm: number;
  moradaExibicao: string;
  isAT: boolean;
  isOF: boolean;
  isCT: boolean;
}

export const MapaPortugal: React.FC<MapaPortugalProps> = ({
  folhas,
  empresas,
  clientes,
  equipamentos,
  onSelectFolha,
  theme = 'dark'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'AT' | 'CT' | 'outros'>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'streets' | 'light'>(() => (theme === 'light' ? 'light' : 'dark'));

  // Count of services currently inside the Oficina (for reference)
  const oficinaCount = useMemo(() => {
    return folhas.filter(f => {
      if (f.status === 'Concluído' || f.status.startsWith('FEITO') || f.status === 'Feito') return false;
      return (
        f.localizacaoTipo === 'oficina' ||
        f.tipo === 'Oficina' ||
        f.status.startsWith('OF -') ||
        f.localizacao?.toLowerCase().includes('oficina')
      );
    }).length;
  }, [folhas]);

  // 1. Filter all OPEN Folhas across Portugal (EXCLUDING services currently in the Oficina)
  const openExternalFolhas = useMemo(() => {
    return folhas.filter(f => {
      // Exclude finished / billed
      if (f.status === 'Concluído' || f.status.startsWith('FEITO') || f.status === 'Feito') return false;

      // Exclude services that are located in the Oficina
      const isInOficina =
        f.localizacaoTipo === 'oficina' ||
        f.tipo === 'Oficina' ||
        f.status.startsWith('OF -') ||
        f.localizacao?.toLowerCase().includes('oficina');

      return !isInOficina;
    });
  }, [folhas]);

  // 2. Map every open external folha to GPS coordinates & metadata
  const markerItems: MapMarkerItem[] = useMemo(() => {
    return openExternalFolhas.map(f => {
      const emp = empresas.find(e => e.id === f.empresaId);
      const cli = clientes.find(c => c.id === f.clienteId || c.empresaId === f.empresaId);
      const eq = equipamentos.find(
        e => e.id === f.equipamentoId || e.matricula.toUpperCase() === f.matricula.toUpperCase()
      );

      // Best address resolution: Folha Localização > Estaleiro > Empresa Sede > Nome da Empresa
      let targetAddress = f.localizacao?.trim() || '';
      if (!targetAddress) {
        if (emp?.estaleiros && emp.estaleiros.length > 0 && eq?.estaleiroId) {
          const est = emp.estaleiros.find(s => s.id === eq.estaleiroId);
          if (est?.morada) targetAddress = `${est.morada}, ${est.nome}`;
        } else if (emp?.moradaSede) {
          targetAddress = emp.moradaSede;
        } else if (emp?.nome) {
          targetAddress = emp.nome;
        }
      }

      const coords = resolvePortugalCoordinates(targetAddress, f.id);
      const distKm = calculateDistanceKm(OFICINA_HP_BASE.lat, OFICINA_HP_BASE.lng, coords.lat, coords.lng);

      return {
        folha: f,
        empresa: emp,
        cliente: cli,
        equipamento: eq,
        coords,
        distanciaKm: f.distanciaKms || distKm,
        moradaExibicao: targetAddress || `${coords.cidade}, ${coords.distrito}`,
        isAT: f.tipo === 'Assistência Técnica' || f.status.startsWith('AT'),
        isOF: false,
        isCT: f.tipo === 'Contrato' || f.status.startsWith('CT')
      };
    });
  }, [openExternalFolhas, empresas, clientes, equipamentos]);

  // 3. Filtered Marker Items for Display and Side List
  const filteredMarkers = useMemo(() => {
    return markerItems.filter(item => {
      // Type Filter
      if (filterType === 'AT' && !item.isAT) return false;
      if (filterType === 'CT' && !item.isCT) return false;
      if (filterType === 'outros' && (item.isAT || item.isCT)) return false;

      // Region Filter
      if (selectedRegion !== 'all' && item.coords.regiao !== selectedRegion && item.coords.distrito !== selectedRegion) {
        return false;
      }

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNumber = item.folha.numero.toLowerCase().includes(q);
        const matchMatricula = item.folha.matricula.toLowerCase().includes(q);
        const matchEmpresa = item.empresa?.nome.toLowerCase().includes(q) || false;
        const matchMorada = item.moradaExibicao.toLowerCase().includes(q);
        const matchCity = item.coords.cidade.toLowerCase().includes(q) || item.coords.distrito.toLowerCase().includes(q);
        const matchClient = item.cliente?.nome.toLowerCase().includes(q) || false;
        return matchNumber || matchMatricula || matchEmpresa || matchMorada || matchCity || matchClient;
      }

      return true;
    }).sort(sortByDateDesc(item => item.folha.data, item => item.folha.numero));
  }, [markerItems, filterType, selectedRegion, searchQuery]);

  // 4. Summary counts by Region
  const stats = useMemo(() => {
    const total = markerItems.length;
    const atCount = markerItems.filter(m => m.isAT).length;
    const ctCount = markerItems.filter(m => m.isCT).length;
    const outrosCount = markerItems.filter(m => !m.isAT && !m.isCT).length;
    const norteCount = markerItems.filter(m => m.coords.regiao === 'Norte').length;
    const centroCount = markerItems.filter(m => m.coords.regiao === 'Centro').length;
    const lisboaCount = markerItems.filter(m => m.coords.regiao === 'Lisboa & V.T.').length;
    const sulCount = markerItems.filter(m => m.coords.regiao === 'Alentejo' || m.coords.regiao === 'Algarve').length;
    return { total, atCount, ctCount, outrosCount, norteCount, centroCount, lisboaCount, sulCount, oficinaCount };
  }, [markerItems, oficinaCount]);

  // 5. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center of Portugal
      const map = L.map(mapContainerRef.current, {
        center: [39.6, -8.1],
        zoom: 7.4,
        minZoom: 6,
        maxZoom: 18,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;

    // Remove existing tile layer and apply selected theme tile
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; OpenStreetMap contributors';

    if (mapStyle === 'dark') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri &copy; OpenStreetMap';
    } else if (mapStyle === 'light') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri &copy; OpenStreetMap';
    } else if (mapStyle === 'streets') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19
    }).addTo(map);

    return () => {
      // Keep map instance mounted across prop updates
    };
  }, [mapStyle]);

  // 6. Dynamic Zoom-Aware Marker Clustering & Pin Rendering
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    const renderMarkers = () => {
      group.clearLayers();

      // Screen-pixel distance threshold for grouping overlapping pins (e.g. 36px)
      // When pins overlap on screen at current zoom, group them into a cluster with the count.
      // When zoomed in so pins are separated by > 36px, render each as an individual pin WITHOUT the number!
      const PIXEL_RADIUS = 36;

      interface DynamicCluster {
        id: string;
        centerLat: number;
        centerLng: number;
        items: MapMarkerItem[];
        screenPoint: L.Point;
      }

      const clusters: DynamicCluster[] = [];

      filteredMarkers.forEach(item => {
        const screenPt = map.latLngToLayerPoint([item.coords.lat, item.coords.lng]);

        // Find if there is an existing cluster within screen pixel radius
        const existing = clusters.find(c => {
          return screenPt.distanceTo(c.screenPoint) <= PIXEL_RADIUS;
        });

        if (existing) {
          existing.items.push(item);
          // Centroid lat/lng
          const n = existing.items.length;
          existing.centerLat = (existing.centerLat * (n - 1) + item.coords.lat) / n;
          existing.centerLng = (existing.centerLng * (n - 1) + item.coords.lng) / n;
          existing.screenPoint = map.latLngToLayerPoint([existing.centerLat, existing.centerLng]);
        } else {
          clusters.push({
            id: `cluster_${item.folha.id}`,
            centerLat: item.coords.lat,
            centerLng: item.coords.lng,
            items: [item],
            screenPoint: screenPt
          });
        }
      });

      clusters.forEach(cluster => {
        const count = cluster.items.length;
        const isMulti = count > 1;
        const hasAT = cluster.items.some(m => m.isAT);
        const hasCT = cluster.items.some(m => m.isCT);

        const pinColor = hasAT ? '#f97316' : hasCT ? '#a855f7' : '#0284c7';
        const pinBgGradient = hasAT
          ? 'from-orange-500 to-amber-600'
          : hasCT
          ? 'from-purple-600 to-indigo-600'
          : 'from-sky-500 to-blue-600';

        // When overlapping (isMulti): Show the NUMBER of services on the pin
        // When single (isMulti === false): DO NOT show the number, show the icon!
        const pinIconHtml = isMulti
          ? `
          <div class="relative group cursor-pointer flex items-center justify-center" id="cluster-${cluster.id}" title="${count} serviços sobrepostos. Clique para ver ou faça zoom para separar.">
            <div class="absolute -top-1 -left-1 w-11 h-11 rounded-2xl animate-ping opacity-25" style="background-color: ${pinColor};"></div>
            <div class="relative w-9 h-9 rounded-2xl bg-gradient-to-br ${pinBgGradient} border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-sm transform hover:scale-125 transition-transform">
              <span class="tracking-tight font-black">${count}</span>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white" style="background-color: ${pinColor};"></div>
          </div>
        `
          : `
          <div class="relative group cursor-pointer flex items-center justify-center" id="pin-${cluster.items[0].folha.id}" title="Folha ${cluster.items[0].folha.numero} - ${cluster.items[0].empresa?.nome || ''}">
            <div class="absolute -top-1 -left-1 w-9 h-9 rounded-full animate-pulse" style="background-color: ${pinColor}33;"></div>
            <div class="relative w-8 h-8 rounded-2xl bg-gradient-to-br ${pinBgGradient} border-2 border-white shadow-xl flex items-center justify-center text-white font-extrabold text-[12px] transform hover:scale-125 transition-transform">
              ${hasAT ? '⚡' : hasCT ? '📜' : '🛡️'}
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white" style="background-color: ${pinColor};"></div>
          </div>
        `;

        const customPin = L.divIcon({
          html: pinIconHtml,
          className: 'custom-folha-pin',
          iconSize: isMulti ? [38, 38] : [32, 32],
          iconAnchor: isMulti ? [19, 19] : [16, 16],
          popupAnchor: [0, -20]
        });

        const marker = L.marker([cluster.centerLat, cluster.centerLng], { icon: customPin });

        // Popup Content
        const popupContent = document.createElement('div');
        popupContent.className = 'font-sans p-1 text-slate-900 min-w-[280px] max-w-[340px] space-y-2';

        popupContent.innerHTML = `
          <div class="border-b pb-2 border-slate-200">
            <div class="flex items-center justify-between gap-1 mb-1">
              <span style="background-color: ${pinColor}; color: white;" class="font-mono font-black text-xs px-2 py-0.5 rounded-lg shadow-sm">
                ${isMulti ? `${count} SERVIÇOS NO LOCAL` : cluster.items[0].folha.numero}
              </span>
              <span class="text-[10px] font-bold text-sky-700 font-mono">
                📍 ${cluster.items[0].distanciaKm} Km da Sede
              </span>
            </div>
            <h4 class="text-sm font-black text-slate-900 leading-tight">${cluster.items[0].empresa?.nome || 'Cliente Geral'}</h4>
            <p class="text-[11px] text-slate-500 font-medium">📍 ${cluster.items[0].moradaExibicao}</p>
          </div>

          <div class="space-y-2 max-h-[300px] overflow-y-auto pt-1 pr-1 custom-scrollbar">
            ${cluster.items
              .map(
                item => `
              <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 shadow-sm hover:border-hp-500/50 transition-colors">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-black text-xs text-hp-600">${item.folha.numero}</span>
                    <span class="font-mono font-bold text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded">
                      ${item.folha.matricula}
                    </span>
                  </div>
                  <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    item.isAT ? 'bg-orange-100 text-orange-700' : item.isCT ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                  }">
                    ${item.folha.tipo}
                  </span>
                </div>

                ${
                  item.folha.anomalias || item.folha.notasInternas
                    ? `<div class="text-[11px] font-semibold text-slate-700 leading-snug line-clamp-2">
                        ${item.folha.anomalias || item.folha.notasInternas}
                      </div>`
                    : ''
                }

                <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/80">
                  <span>Estado: <b class="text-slate-800">${item.folha.status}</b></span>
                  ${item.folha.data ? `<span class="font-mono">${formatDate(item.folha.data)}</span>` : ''}
                </div>

                ${
                  item.cliente?.telemovel
                    ? `<div class="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>Contacto:</span>
                        <a href="tel:${item.cliente.telemovel}" class="font-bold text-emerald-600 hover:underline">
                          📞 ${item.cliente.telemovel}
                        </a>
                      </div>`
                    : ''
                }

                <button id="btn-open-${item.folha.id}" class="w-full py-1.5 px-2.5 bg-gradient-to-r from-hp-600 to-indigo-600 hover:from-hp-500 hover:to-indigo-500 text-white font-extrabold text-[11px] rounded-lg shadow flex items-center justify-center gap-1 transition-all mt-1">
                  <span>Abrir Folha ${item.folha.numero}</span> ➔
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        `;

        // Attach click listener on popup buttons to navigate to Folha
        cluster.items.forEach(item => {
          const btn = popupContent.querySelector(`#btn-open-${item.folha.id}`);
          if (btn) {
            btn.addEventListener('click', () => {
              onSelectFolha(item.folha);
            });
          }
        });

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setSelectedMarkerId(cluster.items[0].folha.id);
        });

        group.addLayer(marker);
      });
    };

    // Initial render
    renderMarkers();

    // Dynamically re-cluster markers when the user zooms or pans the map
    map.on('zoomend', renderMarkers);
    map.on('moveend', renderMarkers);

    // Auto-fit bounds on first load or filter change
    if (filteredMarkers.length > 0) {
      const latLngs = filteredMarkers.map(m => [m.coords.lat, m.coords.lng] as [number, number]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 12 });
    }

    return () => {
      map.off('zoomend', renderMarkers);
      map.off('moveend', renderMarkers);
    };
  }, [filteredMarkers, onSelectFolha]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // Handle clicking a card in the side list to flyTo on the map
  const handleFlyToMarker = (item: MapMarkerItem) => {
    setSelectedMarkerId(item.folha.id);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([item.coords.lat, item.coords.lng], 13, {
        duration: 1.2
      });
    }
  };

  const handleResetPortugalView = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([39.6, -8.1], 7.4, { duration: 1 });
    }
  };

  // Generate Executive A3 PDF with Visual Map Snapshot + Full Summary Table
  const handlePrintA3PDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfToast('A capturar mapa e a preparar documento A3...');

    try {
      let mapImageBase64: string | undefined;
      const mapEl = mapContainerRef.current;

      if (mapEl) {
        try {
          // Brief pause to ensure all tiles and pins are rendered
          await new Promise(res => setTimeout(res, 250));

          const canvas = await html2canvas(mapEl, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: 1.8,
            backgroundColor: mapStyle === 'dark' ? '#090d16' : '#ffffff'
          });
          mapImageBase64 = canvas.toDataURL('image/jpeg', 0.88);
        } catch (captureErr) {
          console.warn('[MapaPortugal] Aviso na captura de imagem do mapa:', captureErr);
        }
      }

      let filterDesc = '';
      if (filterType !== 'all') {
        filterDesc += filterType === 'AT' ? 'Apenas Assistência Técnica' : filterType === 'CT' ? 'Apenas Contratos' : 'Outros';
      }
      if (selectedRegion !== 'all') {
        filterDesc += (filterDesc ? ' • ' : '') + `Região: ${selectedRegion}`;
      }
      if (searchQuery) {
        filterDesc += (filterDesc ? ' • ' : '') + `Pesquisa: "${searchQuery}"`;
      }

      const doc = generateMapaServicosA3PDF({
        mapImageBase64,
        items: filteredMarkers,
        stats,
        filterDescription: filterDesc || 'Todos os serviços no terreno'
      });

      const fileName = `Mapa_Servicos_Portugal_A3_${getTodayFormatted().replace(/\//g, '-')}.pdf`;
      doc.save(fileName);

      // Also create an object URL to allow instant browser preview/print tab
      try {
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, '_blank');
        if (printWindow) {
          printWindow.focus();
        }
      } catch (e) {}

      setPdfToast(`✅ PDF A3 gerado com sucesso! (${fileName})`);
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err: any) {
      console.error('[MapaPortugal] Erro ao gerar PDF A3:', err);
      setPdfToast(`❌ Erro ao gerar PDF: ${err?.message || err}`);
      setTimeout(() => setPdfToast(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* 1. Header Bar & KPI Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-hp-600 via-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-hp-600/30">
            <Compass className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Mapa de Serviços em Portugal
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-hp-500/20 text-hp-400 border border-hp-500/30">
                {stats.total} no Terreno
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Localização geográfica de clientes com pedidos em aberto <b className="text-slate-300">(excluindo viaturas na Oficina)</b>.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Print A3 Button */}
          <button
            onClick={handlePrintA3PDF}
            disabled={isGeneratingPdf}
            className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 border ${
              isGeneratingPdf
                ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white border-emerald-400/40 shadow-emerald-950/40'
            }`}
            title="Imprimir Mapa em A3 com mapa visual e lista resumida de todas as folhas em aberto"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                <span>A Preparar PDF A3...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>Imprimir em A3 (Mapa + Lista)</span>
              </>
            )}
          </button>

          {/* Map Tile Style Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setMapStyle('dark')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                mapStyle === 'dark' ? 'bg-hp-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              🌙 Escuro
            </button>
            <button
              onClick={() => setMapStyle('light')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                mapStyle === 'light' ? 'bg-slate-200 text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              ☀️ Claro
            </button>
            <button
              onClick={() => setMapStyle('streets')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                mapStyle === 'streets' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              🗺️ Ruas
            </button>
          </div>

          <button
            onClick={handleResetPortugalView}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95"
          >
            <Navigation className="w-4 h-4 text-hp-400" /> Ver Todo Portugal
          </button>
        </div>
      </div>

      {/* 2. Top Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total no Terreno</span>
            <b className="text-xl font-black text-white font-mono">{stats.total}</b>
          </div>
          <div className="w-9 h-9 rounded-xl bg-hp-500/20 text-hp-400 flex items-center justify-center font-bold">
            🇵🇹
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-orange-400 block">Assistência Técnica</span>
            <b className="text-xl font-black text-orange-400 font-mono">{stats.atCount}</b>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
            ⚡
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-purple-400 block">Contratos</span>
            <b className="text-xl font-black text-purple-400 font-mono">{stats.ctCount}</b>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            📜
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between opacity-80">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Na Oficina (Sede)</span>
            <b className="text-xl font-black text-slate-300 font-mono">{stats.oficinaCount}</b>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center font-bold">
            🏢
          </div>
        </div>
      </div>

      {/* 3. Main Map Grid & Side Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Interactive Leaflet Map Box (8 Columns) */}
        <div className="lg:col-span-8 rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl relative">
          <div
            ref={mapContainerRef}
            className="w-full h-[620px] z-10"
            style={{ background: '#090d16' }}
          />
        </div>

        {/* Side Panel: Search, Region Filter & Interactive Open Orders List (4 Columns) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Filter & Search Box */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar cliente, matrícula, localidade..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:border-hp-500"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
              {[
                { id: 'all', label: `Todos (${stats.total})` },
                { id: 'AT', label: `⚡ AT (${stats.atCount})` },
                { id: 'CT', label: `📜 CT (${stats.ctCount})` }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id as any)}
                  className={`py-1.5 rounded-xl transition-all text-center ${
                    filterType === t.id
                      ? 'bg-hp-600 text-white shadow-md shadow-hp-600/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Region Selector */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Região:</span>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="py-1 px-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold"
              >
                <option value="all">Todo o País ({stats.total})</option>
                <option value="Norte">Norte ({stats.norteCount})</option>
                <option value="Centro">Centro ({stats.centroCount})</option>
                <option value="Lisboa & V.T.">Lisboa & V.T. ({stats.lisboaCount})</option>
                <option value="Alentejo">Alentejo</option>
                <option value="Algarve">Algarve</option>
                <option value="Madeira">Madeira</option>
                <option value="Açores">Açores</option>
              </select>
            </div>

            {/* Quick Print A3 Button in Side Panel */}
            <button
              onClick={handlePrintA3PDF}
              disabled={isGeneratingPdf}
              className={`w-full py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 border ${
                isGeneratingPdf
                  ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white border-emerald-400/40 shadow-emerald-950/40'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>A Gerar Relatório A3...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 text-emerald-200" />
                  <span>Imprimir em A3 (Mapa + Lista)</span>
                </>
              )}
            </button>
          </div>

          {/* List of Open Orders on Map */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredMarkers.length === 0 ? (
              <div className="p-6 text-center rounded-3xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                <p className="font-bold text-white">Nenhum pedido em aberto encontrado</p>
                <p>Altere os filtros ou pesquise por outra localidade.</p>
              </div>
            ) : (
              filteredMarkers.map(item => {
                const isSelected = selectedMarkerId === item.folha.id;
                return (
                  <div
                    key={item.folha.id}
                    onClick={() => handleFlyToMarker(item)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-hp-950/60 border-hp-500/80 shadow-lg shadow-hp-600/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-hp-400 bg-hp-500/10 px-2 py-0.5 rounded-md">
                            {item.folha.numero}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatDate(item.folha.data)}
                          </span>
                          <b className="text-white text-xs font-bold truncate max-w-[130px]">
                            {item.empresa?.nome || 'Cliente Geral'}
                          </b>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          📍 {item.moradaExibicao}
                        </p>
                      </div>

                      <Badge
                        variant={
                          item.isAT ? 'warning' : item.isCT ? 'info' : 'success'
                        }
                      >
                        {item.isAT ? 'AT' : item.isCT ? 'CT' : 'OF'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60 font-mono">
                      <span className="text-slate-300 font-bold flex items-center gap-1">
                        🚗 {item.folha.matricula}
                      </span>
                      <span className="text-sky-400 font-bold">
                        {item.distanciaKm} Km de Albergaria
                      </span>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleFlyToMarker(item);
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 border border-slate-800"
                      >
                        <MapPin className="w-3 h-3 text-hp-400" /> Focar no Mapa
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectFolha(item.folha);
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-md shadow-hp-600/30"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver Folha
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {pdfToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-slate-900/95 text-white text-xs font-bold rounded-2xl border border-emerald-500/40 shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in slide-in-from-bottom-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{pdfToast}</span>
        </div>
      )}
    </div>
  );
};
