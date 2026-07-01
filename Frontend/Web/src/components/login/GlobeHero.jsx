import { useCallback, useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { Globe as GlobeIcon } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '@/lib/api'
import boundaryData from '@/assets/nong-son-boundary.json'

// Fix Leaflet icon path cho Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',   import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

const NONG_SON   = { lat: 15.6809809, lng: 108.07218592 }
const FAR_VIEW   = { lat: 14, lng: 108, altitude: 2.6 }
const CLOSE_VIEW = { lat: NONG_SON.lat, lng: NONG_SON.lng, altitude: 0.08 }

const MAP_CENTER = [15.6809809, 108.07218592]
const MAP_ZOOM   = 14

const STATUS_COLOR = { pending: '#f59e0b', draft: '#3b82f6' }
const STATUS_LABEL = { pending: 'Đang chờ xử lý', draft: 'Đang soạn thảo' }

function createDotIcon(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;width:26px;height:26px;border-radius:50%;background:${color};opacity:.25;animation:nongson-pulse 1.8s ease-out infinite"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>
      </div>
      <style>@keyframes nongson-pulse{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.6);opacity:0}}</style>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  })
}

export default function GlobeHero() {
  const globeEl   = useRef()
  const mapRef    = useRef()
  const leafletEl = useRef()
  const mapDivRef = useRef()
  const backRef   = useRef()
  const hintRef   = useRef()
  const zoomedRef = useRef(false)
  const flyTimer  = useRef()

  const [size, setSize]               = useState({ width: window.innerWidth, height: window.innerHeight })
  const [markerCount, setMarkerCount] = useState(0)

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => () => clearTimeout(flyTimer.current), [])

  const initLeaflet = useCallback(() => {
    if (leafletEl.current || !mapDivRef.current) return

    const map = L.map(mapDivRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(map)

    // Vệ tinh ESRI
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri, Maxar, Earthstar Geographics', maxZoom: 19 }
    ).addTo(map)

    // Lớp nhãn địa danh
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.85 }
    ).addTo(map)

    // Ranh giới Nông Sơn — đường xanh dương
    L.geoJSON(boundaryData, {
      style: {
        color: '#1d4ed8',
        weight: 3,
        opacity: 0.92,
        fillColor: '#1d4ed8',
        fillOpacity: 0.06,
      },
    }).addTo(map)

    // Markers hồ sơ chưa xử lý
    api.get('/api/public/map-markers')
      .then((r) => {
        const data = r.data || []
        setMarkerCount(data.length)
        data.forEach((m) => {
          const color = STATUS_COLOR[m.status] || '#6b7280'
          const popup = `
            <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:200px">
              <div style="font-weight:700;color:#1d4ed8;margin-bottom:3px">${m.icon} ${m.category}</div>
              <div style="margin-bottom:3px">
                <span style="background:#f3f4f6;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;color:#374151">#${m.id}</span>
                <span style="margin-left:6px;font-size:11px;color:#6b7280">${new Date(m.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
              ${m.address ? `<div style="color:#6b7280;font-size:11px;margin-bottom:3px">📍 ${m.address}</div>` : ''}
              <div style="color:#374151;margin-bottom:5px">${m.content}</div>
              <span style="background:${color}22;color:${color};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">● ${STATUS_LABEL[m.status] || 'Đang xử lý'}</span>
            </div>`
          L.marker([m.lat, m.lng], { icon: createDotIcon(color) })
            .bindPopup(popup, { maxWidth: 240 })
            .addTo(map)
        })
      })
      .catch(() => {})

    leafletEl.current = map
  }, [])

  const flyToNongSon = useCallback(() => {
    if (!globeEl.current || zoomedRef.current) return
    zoomedRef.current = true
    globeEl.current.controls().autoRotate = false
    globeEl.current.pointOfView(CLOSE_VIEW, 4000)
    if (hintRef.current) hintRef.current.style.opacity = '0'

    clearTimeout(flyTimer.current)
    flyTimer.current = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.style.opacity = '1'
        mapRef.current.style.pointerEvents = 'auto'
      }
      if (backRef.current) {
        backRef.current.style.opacity = '1'
        backRef.current.style.pointerEvents = 'auto'
      }
      initLeaflet()
      setTimeout(() => leafletEl.current?.invalidateSize(), 1400)
    }, 3300)
  }, [initLeaflet])

  const backToGlobe = useCallback(() => {
    clearTimeout(flyTimer.current)
    if (mapRef.current) {
      mapRef.current.style.opacity = '0'
      mapRef.current.style.pointerEvents = 'none'
    }
    if (backRef.current) {
      backRef.current.style.opacity = '0'
      backRef.current.style.pointerEvents = 'none'
    }
    if (hintRef.current) hintRef.current.style.opacity = ''
    zoomedRef.current = false

    if (globeEl.current) {
      globeEl.current.pointOfView(FAR_VIEW, 2600)
      setTimeout(() => {
        if (globeEl.current) globeEl.current.controls().autoRotate = true
      }, 2600)
    }
  }, [])

  const onGlobeReady = useCallback(() => {
    const c = globeEl.current.controls()
    c.autoRotate = true
    c.autoRotateSpeed = 0.4
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.minDistance = 102
    c.maxDistance = 800
    globeEl.current.pointOfView(FAR_VIEW, 0)
  }, [])

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'radial-gradient(circle at 64% 42%, #0a1430 0%, #050a1c 55%, #01030a 100%)' }}
    >
      {/* Quả địa cầu */}
      <div className="absolute inset-0 z-0" style={{ transform: 'translateX(-11%)' }}>
        <Globe
          ref={globeEl}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/globe/earth-blue-marble.jpg"
          bumpImageUrl="/globe/earth-topology.png"
          showAtmosphere
          atmosphereColor="#6fb0ff"
          atmosphereAltitude={0.2}
          pointsData={[NONG_SON]}
          pointColor={() => '#f4c245'}
          pointAltitude={0.015}
          pointRadius={0.45}
          pointResolution={18}
          ringsData={[NONG_SON]}
          ringColor={() => (t) => `rgba(244,194,69,${1 - t})`}
          ringMaxRadius={5}
          ringPropagationSpeed={3}
          ringRepeatPeriod={900}
          onGlobeClick={flyToNongSon}
          onPointClick={flyToNongSon}
          onGlobeReady={onGlobeReady}
        />
      </div>

      {/* Bản đồ Leaflet */}
      <div
        ref={mapRef}
        className="absolute inset-0 z-[1]"
        style={{ opacity: 0, pointerEvents: 'none', transition: 'opacity 1.2s ease' }}
      >
        <div ref={mapDivRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />

        <div style={{
          position: 'absolute', top: 70, left: 12, zIndex: 1000,
          background: 'rgba(255,255,255,.93)',
          borderRadius: 10, padding: '8px 13px',
          fontFamily: 'sans-serif', fontSize: 12,
          boxShadow: '0 2px 10px rgba(0,0,0,.25)',
          lineHeight: 1.5, pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13 }}>
            🗺️ Bản đồ phản ánh
          </div>
          <div style={{ color: '#374151' }}>Xã Nông Sơn</div>
          <div style={{ color: markerCount ? '#f59e0b' : '#6b7280', fontWeight: 600, marginTop: 2 }}>
            {markerCount > 0
              ? `${markerCount} hồ sơ đang chờ xử lý`
              : 'Không có hồ sơ chờ xử lý'}
          </div>
        </div>
      </div>

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{ background: 'radial-gradient(120% 100% at 50% 50%, rgba(0,0,0,0) 58%, rgba(2,4,12,.55) 100%)' }}
      />

      {/* Hint */}
      <div
        ref={hintRef}
        className="pointer-events-none absolute z-[4] flex items-center gap-2 text-[13px] font-semibold"
        style={{
          left: 'clamp(20px,4vw,64px)', bottom: 30,
          color: 'rgba(220,233,255,.92)', textShadow: '0 1px 10px rgba(0,0,0,.8)',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f4c245', boxShadow: '0 0 0 4px rgba(244,194,69,.25)' }} />
        Kéo để xoay • cuộn để phóng to • nhấp vào địa cầu để bay tới Nông Sơn
      </div>

      <button
        ref={backRef}
        type="button"
        onClick={backToGlobe}
        className="absolute z-[5] flex h-11 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-bold text-white transition-opacity duration-500 hover:border-blue-400"
        style={{
          left: 'clamp(20px,4vw,64px)', bottom: 28,
          opacity: 0, pointerEvents: 'none',
          border: '1px solid rgba(255,255,255,.35)',
          background: 'rgba(8,16,36,.7)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <GlobeIcon className="h-4 w-4" /> Quay lại quả địa cầu
      </button>
    </div>
  )
}
