// JooJoo Land - 34필지 경계 지도
// VWorld 오픈API: 주소 → 좌표 → 지적 폴리곤 조회

const STORAGE_KEY = 'vworld_api_key';

// ==================== 상태 ====================
let map;
let baseLayers = {};
let currentBaseLayer = null;
let cadastralLayer = null;
let polygonsById = {};   // no -> { polygon, label, parcel }
let resolvedParcels = []; // 성공한 필지만

// ==================== 초기화 ====================
function init() {
  setupKeyModal();
  buildParcelList();
  setupFilters();
  setupCollapsibles();

  // 우선순위: 1) .env → config.js 로 주입된 window.VWORLD_KEY,
  //          2) localStorage,  3) 모달 입력
  let envKey = (window.VWORLD_KEY || '').trim();
  if (envKey === 'PASTE_YOUR_KEY_HERE') envKey = '';
  const storageKey = localStorage.getItem(STORAGE_KEY);
  const key = envKey || storageKey;

  if (!key) {
    showKeyModal();
    return;
  }
  if (envKey) {
    console.info('[app] .env → config.js 에서 VWorld 키 로드');
  }
  startMap(key);
}

function showKeyModal() {
  document.getElementById('key-modal').classList.remove('hidden');
  const hint = document.getElementById('domain-hint');
  hint.textContent = `${window.location.protocol}//${window.location.host || 'localhost:8000'}`;
}

function setupKeyModal() {
  document.getElementById('key-save').addEventListener('click', () => {
    const val = document.getElementById('key-input').value.trim();
    if (!val) {
      alert('API 키를 입력해주세요');
      return;
    }
    localStorage.setItem(STORAGE_KEY, val);
    document.getElementById('key-modal').classList.add('hidden');
    startMap(val);
  });
  document.getElementById('reset-key').addEventListener('click', () => {
    if (confirm('API 키를 재설정하시겠습니까?')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

// ==================== 지도 초기화 ====================
function startMap(key) {
  // 양동면 금왕리 대략 중심 (산205 근처)
  map = L.map('map', {
    center: [37.378, 127.738],
    zoom: 15,
    zoomControl: true,
  });
  window.LeafletMap = map;

  // 2D/3D 토글
  const btn2d = document.getElementById('mode-2d');
  const btn3d = document.getElementById('mode-3d');
  btn2d.addEventListener('click', () => {
    if (!window.CesiumApp) return;
    window.CesiumApp.hide();
    btn2d.classList.add('active');
    btn3d.classList.remove('active');
  });
  btn3d.addEventListener('click', async () => {
    if (!window.CesiumApp) return;
    btn3d.disabled = true;
    btn3d.textContent = '3D 로딩...';
    try {
      await window.CesiumApp.show();
      btn3d.classList.add('active');
      btn2d.classList.remove('active');
    } catch (e) {
      console.error('3D 전환 실패:', e);
      alert('3D 로드 실패: ' + e.message);
    } finally {
      btn3d.disabled = false;
      btn3d.textContent = '3D';
    }
  });

  // 베이스 레이어
  const satellite = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/{z}/{y}/{x}.jpeg`,
    { maxZoom: 19, attribution: '© VWorld' }
  );
  const satelliteHybrid = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Hybrid/{z}/{y}/{x}.png`,
    { maxZoom: 19 }
  );
  const base = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`,
    { maxZoom: 19, attribution: '© VWorld' }
  );
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  });

  baseLayers.satellite = L.layerGroup([satellite, satelliteHybrid]);
  baseLayers.base = base;
  baseLayers.osm = osm;

  baseLayers.satellite.addTo(map);
  currentBaseLayer = baseLayers.satellite;

  // 지적편집도 overlay (공공 WMS)
  cadastralLayer = L.tileLayer.wms(
    `https://api.vworld.kr/req/wms?key=${key}`,
    {
      layers: 'lp_pa_cbnd_bubun',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      maxZoom: 19,
    }
  );
  cadastralLayer.addTo(map);

  // 베이스맵 전환
  document.querySelectorAll('input[name="basemap"]').forEach(el => {
    el.addEventListener('change', (e) => {
      if (currentBaseLayer) map.removeLayer(currentBaseLayer);
      currentBaseLayer = baseLayers[e.target.value];
      currentBaseLayer.addTo(map);
      if (cadastralLayer && map.hasLayer(cadastralLayer)) {
        cadastralLayer.bringToFront();
      }
      Object.values(polygonsById).forEach(({polygon}) => polygon.bringToFront());
    });
  });

  document.getElementById('toggle-cadastral').addEventListener('change', (e) => {
    if (e.target.checked) cadastralLayer.addTo(map);
    else map.removeLayer(cadastralLayer);
  });

  document.getElementById('toggle-labels').addEventListener('change', (e) => {
    Object.values(polygonsById).forEach(({label}) => {
      if (!label) return;
      if (e.target.checked) label.addTo(map);
      else map.removeLayer(label);
    });
    if (window.CesiumApp && window.CesiumApp.toggleLabels) {
      window.CesiumApp.toggleLabels(e.target.checked);
    }
  });

  // 필지 로드
  loadAllParcels(key);
}

// ==================== 필지 목록 (사이드바) ====================
function buildParcelList() {
  const container = document.getElementById('parcel-list');
  container.innerHTML = '';
  window.PARCELS.forEach(p => {
    const item = document.createElement('div');
    item.className = 'parcel-item';
    item.dataset.no = p.no;
    item.innerHTML = `
      <span class="parcel-no">${p.no}</span>
      <span class="parcel-lot">${p.location} ${p.lot}</span>
      <span class="parcel-meta">${p.area_pyeong.toLocaleString()}평</span>
    `;
    item.addEventListener('click', () => {
      const entry = polygonsById[p.no];
      if (entry && entry.polygon) {
        map.fitBounds(entry.polygon.getBounds(), { maxZoom: 18, padding: [40, 40] });
        entry.polygon.openPopup();
        document.querySelectorAll('.parcel-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      }
    });
    container.appendChild(item);
  });
}

function markParcelStatus(no, status) {
  const el = document.querySelector(`.parcel-item[data-no="${no}"]`);
  if (!el) return;
  el.classList.toggle('failed', status === 'failed');
}

// ==================== 사이드바 섹션 접기/펴기 ====================
function setupCollapsibles() {
  const COLLAPSE_KEY = 'joojoo_collapsed_sections';
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) {}

  const toggles = [
    ...document.querySelectorAll('.sidebar-section > h3'),
    ...document.querySelectorAll('.filter-group > strong'),
  ];
  toggles.forEach((title) => {
    const parent = title.parentElement;
    const id = (title.textContent || '').replace(/\s+/g, ' ').trim();
    if (collapsed[id]) parent.classList.add('collapsed');
    title.addEventListener('click', () => {
      parent.classList.toggle('collapsed');
      collapsed[id] = parent.classList.contains('collapsed');
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    });
  });
}

// ==================== 필터 ====================
function setupFilters() {
  // 현재 PARCELS 에서 고유 카테고리·소유자 추출
  const cats = [...new Set(window.PARCELS.map(p => p.category).filter(Boolean))];
  const owners = [...new Set(window.PARCELS.map(p => p.owner).filter(Boolean))];

  const catContainer = document.getElementById('filter-categories');
  const ownerContainer = document.getElementById('filter-owners');
  if (catContainer) {
    catContainer.innerHTML = cats.map(c =>
      `<label><input type="checkbox" class="filter-category" value="${c}" checked /> ${c}</label>`
    ).join('');
  }
  if (ownerContainer) {
    ownerContainer.innerHTML = owners.map(o =>
      `<label><input type="checkbox" class="filter-owner" value="${o}" checked /> ${o}</label>`
    ).join('');
  }

  const apply = () => {
    const activeCats = Array.from(document.querySelectorAll('.filter-category:checked')).map(el => el.value);
    const activeOwners = Array.from(document.querySelectorAll('.filter-owner:checked')).map(el => el.value);
    Object.entries(polygonsById).forEach(([no, {polygon, label, parcel}]) => {
      const visible = activeCats.includes(parcel.category) && activeOwners.includes(parcel.owner);
      if (visible) {
        polygon.addTo(map);
        if (label && document.getElementById('toggle-labels').checked) label.addTo(map);
      } else {
        map.removeLayer(polygon);
        if (label) map.removeLayer(label);
      }
    });
  };
  document.querySelectorAll('.filter-category, .filter-owner').forEach(el => {
    el.addEventListener('change', apply);
  });
}

// ==================== VWorld API 호출 ====================
// 공통 재시도 (transient "INCORRECT_KEY" 등 rate-limit 대응)
async function fetchWithRetry(url, retries = 3, delay = 600) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.response.status === 'OK') return data;
      const err = data.response.error;
      // INCORRECT_KEY 는 transient rate-limit 증상으로 간주 → 재시도
      if (err && (err.code === 'INCORRECT_KEY' || err.code === 'TIMEOUT')) {
        lastErr = new Error(`${err.code}: ${err.text}`);
      } else {
        throw new Error(`${err?.code || data.response.status}: ${err?.text || ''}`);
      }
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) await new Promise(r => setTimeout(r, delay * (i + 1)));
  }
  throw lastErr;
}

async function geocodeParcel(parcel, key) {
  const address = window.buildAddress(parcel);
  const url = `/api/vworld/address?` + new URLSearchParams({
    service: 'address',
    request: 'getcoord',
    version: '2.0',
    crs: 'epsg:4326',
    address: address,
    type: 'PARCEL',
    format: 'json',
    errorformat: 'json',
    key: key,
  });
  const data = await fetchWithRetry(url);
  const pt = data.response.result.point;
  const pnu = data.response.refined?.structure?.level4LC || null;
  return { lng: parseFloat(pt.x), lat: parseFloat(pt.y), pnu };
}

async function wfsQuery(filterParams, key) {
  const url = `/api/vworld/data?` + new URLSearchParams({
    service: 'data',
    request: 'GetFeature',
    data: 'LP_PA_CBND_BUBUN',
    ...filterParams,
    geometry: 'true',
    attribute: 'true',
    format: 'json',
    key: key,
    domain: window.location.hostname || 'localhost',
  });
  const data = await fetchWithRetry(url);
  const fc = data.response.result.featureCollection;
  return (fc && fc.features) ? fc.features : [];
}

// 3단계 fallback: PNU → POINT → BBOX(근처 폴리곤 중 소유 필지 번호 매칭)
async function fetchParcelPolygon(geocoded, parcel, key) {
  const { lng, lat, pnu } = geocoded;

  // 1차: PNU attrFilter
  if (pnu) {
    try {
      const feats = await wfsQuery({
        attrFilter: `pnu:=:${pnu}`,
        size: '1',
      }, key);
      if (feats.length > 0) return feats[0];
    } catch (e) { /* fall through */ }
  }

  // 2차: POINT geomFilter
  try {
    const feats = await wfsQuery({
      geomFilter: `POINT(${lng} ${lat})`,
      size: '1',
    }, key);
    if (feats.length > 0) return feats[0];
  } catch (e) { /* fall through */ }

  // 3차: BBOX geomFilter (약 30m 반경) + 지번번호 매칭
  const d = 0.0003;
  const bbox = `BOX(${lng - d},${lat - d},${lng + d},${lat + d})`;
  const feats = await wfsQuery({
    geomFilter: bbox,
    size: '30',
  }, key);
  if (feats.length === 0) throw new Error('폴리곤 없음');

  // 지번 문자열에서 본번·부번 추출 (예: "산205-3" → 산 205 3)
  const lotMatch = parcel.lot.match(/^(산)?(\d+)(?:-(\d+))?$/);
  if (lotMatch) {
    const [, san, jibun, bu] = lotMatch;
    const jibunNum = parseInt(jibun, 10);
    const buNum = bu ? parseInt(bu, 10) : 0;
    const isSan = san === '산';
    const match = feats.find(f => {
      const p = f.properties || {};
      return parseInt(p.jibun || 0, 10) === jibunNum
          && parseInt(p.bonbun || 0, 10) === jibunNum
          && parseInt(p.bubun || 0, 10) === buNum;
    });
    if (match) return match;
    // feature 속성 이름이 다를 수 있으니 PNU 후미 비교로 시도
    const suffix = `${isSan ? '2' : '1'}${String(jibunNum).padStart(4, '0')}${String(buNum).padStart(4, '0')}`;
    const byPnu = feats.find(f => (f.properties?.pnu || '').endsWith(suffix));
    if (byPnu) return byPnu;
  }
  // 마지막: 점에서 가장 가까운 폴리곤
  return feats[0];
}

// ==================== 전체 로드 ====================
async function loadAllParcels(key) {
  const total = window.PARCELS.length;
  let done = 0;
  let success = 0;
  const allBounds = [];

  updateProgress(0, total, '필지 로드 시작...');

  // 동시 2개씩 (VWorld 레이트리밋 고려)
  const concurrency = 2;
  const queue = [...window.PARCELS];

  async function worker() {
    while (queue.length > 0) {
      const parcel = queue.shift();
      if (!parcel) break;
      try {
        const pt = await geocodeParcel(parcel, key);
        const feature = await fetchParcelPolygon(pt, parcel, key);
        renderParcel(parcel, feature, allBounds);
        success++;
      } catch (e) {
        console.warn(`필지 ${parcel.no} (${parcel.lot}) 실패:`, e.message);
        markParcelStatus(parcel.no, 'failed');
      }
      done++;
      updateProgress(done, total, `로드 중 ${done}/${total} (성공 ${success})`);
    }
  }

  await Promise.all(Array.from({length: concurrency}, () => worker()));

  updateProgress(total, total, `완료: ${success}/${total}필지 표시됨`);
  document.getElementById('count').textContent = `(${success}/${total})`;

  if (allBounds.length > 0) {
    const bounds = L.latLngBounds(allBounds.flat());
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function updateProgress(done, total, text) {
  document.getElementById('progress-text').textContent = text;
  document.getElementById('progress-bar-fill').style.width = `${(done/total)*100}%`;
}

// ==================== 렌더링 ====================
function renderParcel(parcel, feature, allBounds) {
  // 3D 뷰에서도 재사용할 수 있게 Cesium 에 등록
  if (window.CesiumApp) window.CesiumApp.register(parcel, feature);

  const color = window.CATEGORY_COLORS[parcel.category] || '#9e9e9e';

  const geojson = L.geoJSON(feature, {
    style: {
      color: color,
      weight: 2.5,
      opacity: 0.95,
      fillColor: color,
      fillOpacity: 0.35,
    }
  });

  const polygon = geojson.getLayers()[0];
  polygon.bindPopup(buildPopup(parcel, feature));
  polygon.on('click', () => {
    document.querySelectorAll('.parcel-item').forEach(el => el.classList.remove('active'));
    const li = document.querySelector(`.parcel-item[data-no="${parcel.no}"]`);
    if (li) li.classList.add('active');
  });
  polygon.addTo(map);

  // 지번 라벨 (중심점에)
  const center = polygon.getBounds().getCenter();
  const label = L.marker(center, {
    icon: L.divIcon({
      className: 'parcel-label',
      html: `${parcel.lot}`,
      iconSize: [60, 16],
      iconAnchor: [30, 8],
    }),
    interactive: false,
  });
  if (document.getElementById('toggle-labels').checked) {
    label.addTo(map);
  }

  polygonsById[parcel.no] = { polygon, label, parcel };
  allBounds.push(polygon.getBounds());
  resolvedParcels.push(parcel);
}

function buildPopup(parcel, feature) {
  const props = feature.properties || {};
  return `
    <div class="popup-title">${parcel.location} ${parcel.lot}</div>
    <div class="popup-row"><strong>No.</strong><span>${parcel.no}</span></div>
    <div class="popup-row"><strong>지목</strong><span>${parcel.category}</span></div>
    <div class="popup-row"><strong>면적</strong><span>${parcel.area_m2.toLocaleString()}㎡ (${parcel.area_pyeong.toLocaleString()}평)</span></div>
    <div class="popup-row"><strong>소유자</strong><span>${parcel.owner} <small>(${parcel.memo})</small></span></div>
    ${props.pnu ? `<div class="popup-row"><strong>PNU</strong><span style="font-family:monospace;font-size:11px">${props.pnu}</span></div>` : ''}
  `;
}

// ==================== 시작 ====================
document.addEventListener('DOMContentLoaded', init);
