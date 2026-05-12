import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";
import {
  riskBg,
  riskLabel,
  timeAgo,
  type MapAlertRecord,
} from "@/lib/geoAlert";
import { useGeoAlert } from "@/hooks/useGeoAlert";

interface MapPageProps {
  language: AppLanguage;
}

const FALLBACK_COORDS = { lat: 31.2304, lng: 121.4737 };

const depthStyles = [
  "bg-fuchsia-800 text-white border-fuchsia-200/30",
  "bg-purple-700 text-white border-purple-200/35",
  "bg-violet-500 text-white border-violet-200/45",
  "bg-amber-300 text-slate-950 border-amber-100/70",
  "bg-yellow-100 text-slate-950 border-yellow-50/90",
];

const CLUSTER_DEMO_COUNTS = [7, 5, 4, 3, 2];
const TILE_SIZE = 256;
const MAP_HEIGHT = 360;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lonToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const latRad = (clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom;
}

function tileXToLon(x: number, zoom: number) {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileYToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function getReportTitle(report: MapAlertRecord, language: AppLanguage) {
  if (report.kind === "emergency") {
    return copyFor(language, "SOS live location", "SOS 实时位置");
  }

  if (report.helpType === "stalking") {
    return copyFor(language, "Accompaniment request", "陪同接应请求");
  }

  if (report.helpType === "shelter") {
    return copyFor(language, "Safe space request", "安全空间请求");
  }

  return copyFor(language, "Community Help", "社区陪伴支持");
}

function getClusterStyle(count: number) {
  const index = count >= 7 ? 0 : count >= 5 ? 1 : count >= 4 ? 2 : count >= 3 ? 3 : 4;
  return {
    className: depthStyles[index],
    scale: [1.2, 1.05, 0.95, 0.86, 0.78][index],
  };
}

function DemoTileMap({
  center,
  reports,
  language,
}: {
  center: { lat: number; lng: number };
  reports: MapAlertRecord[];
  language: AppLanguage;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(13);
  const [mapWidth, setMapWidth] = useState(360);
  const [mapCenter, setMapCenter] = useState(center);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    center: { lat: number; lng: number };
  } | null>(null);

  useEffect(() => setMapCenter(center), [center.lat, center.lng]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;

    const syncSize = () => setMapWidth(Math.max(320, node.getBoundingClientRect().width));
    syncSize();

    if (!("ResizeObserver" in window)) {
      window.addEventListener("resize", syncSize);
      return () => window.removeEventListener("resize", syncSize);
    }

    const observer = new ResizeObserver(syncSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const centerPoint = useMemo(() => ({
    x: lonToTileX(mapCenter.lng, zoom) * TILE_SIZE,
    y: latToTileY(mapCenter.lat, zoom) * TILE_SIZE,
  }), [mapCenter.lat, mapCenter.lng, zoom]);

  const tiles = useMemo(() => {
    const startX = Math.floor((centerPoint.x - mapWidth / 2) / TILE_SIZE);
    const endX = Math.floor((centerPoint.x + mapWidth / 2) / TILE_SIZE);
    const startY = Math.floor((centerPoint.y - MAP_HEIGHT / 2) / TILE_SIZE);
    const endY = Math.floor((centerPoint.y + MAP_HEIGHT / 2) / TILE_SIZE);
    const maxTile = 2 ** zoom;
    const result: { x: number; y: number; wrappedX: number; left: number; top: number }[] = [];

    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= maxTile) continue;
        result.push({
          x,
          y,
          wrappedX: ((x % maxTile) + maxTile) % maxTile,
          left: x * TILE_SIZE - centerPoint.x + mapWidth / 2,
          top: y * TILE_SIZE - centerPoint.y + MAP_HEIGHT / 2,
        });
      }
    }

    return result;
  }, [centerPoint.x, centerPoint.y, mapWidth, zoom]);

  const markers = useMemo(() => reports.slice(0, 5).map((report, index) => {
    const count = CLUSTER_DEMO_COUNTS[index] ?? 2;
    const zoomScale = 0.82 + (zoom - 11) * 0.12;
    const point = {
      x: lonToTileX(report.lng, zoom) * TILE_SIZE,
      y: latToTileY(report.lat, zoom) * TILE_SIZE,
    };
    return {
      report,
      count,
      left: point.x - centerPoint.x + mapWidth / 2,
      top: point.y - centerPoint.y + MAP_HEIGHT / 2,
      style: getClusterStyle(count),
      zoomScale,
    };
  }), [centerPoint.x, centerPoint.y, mapWidth, reports, zoom]);

  const userMarker = useMemo(() => {
    const point = {
      x: lonToTileX(center.lng, zoom) * TILE_SIZE,
      y: latToTileY(center.lat, zoom) * TILE_SIZE,
    };

    return {
      left: point.x - centerPoint.x + mapWidth / 2,
      top: point.y - centerPoint.y + MAP_HEIGHT / 2,
    };
  }, [center.lat, center.lng, centerPoint.x, centerPoint.y, mapWidth, zoom]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    const startCenterX = lonToTileX(dragStart.center.lng, zoom) * TILE_SIZE;
    const startCenterY = latToTileY(dragStart.center.lat, zoom) * TILE_SIZE;
    setMapCenter({
      lng: tileXToLon((startCenterX - dx) / TILE_SIZE, zoom),
      lat: tileYToLat((startCenterY - dy) / TILE_SIZE, zoom),
    });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const centerX = lonToTileX(mapCenter.lng, zoom) * TILE_SIZE;
    const centerY = latToTileY(mapCenter.lat, zoom) * TILE_SIZE;
    setMapCenter({
      lng: tileXToLon((centerX + event.deltaX) / TILE_SIZE, zoom),
      lat: tileYToLat((centerY + event.deltaY) / TILE_SIZE, zoom),
    });
  };

  const handleZoom = (nextZoom: number) => {
    setZoom(clamp(nextZoom, 11, 15));
  };

  return (
    <div
      ref={mapRef}
      className="relative h-[360px] touch-none overflow-hidden overscroll-contain rounded-2xl border border-border bg-[linear-gradient(135deg,hsl(336_92%_96%),hsl(270_80%_96%))] cursor-grab active:cursor-grabbing"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragStart({ x: event.clientX, y: event.clientY, center: mapCenter });
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragStart(null)}
      onPointerCancel={() => setDragStart(null)}
      onWheel={handleWheel}
    >
      <div className="absolute inset-0">
        {tiles.map((tile) => (
          <img
            key={`${tile.x}-${tile.y}-${zoom}`}
            alt=""
            className="absolute h-64 w-64 select-none"
            draggable={false}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.wrappedX}/${tile.y}.png`}
            style={{
              left: tile.left,
              top: tile.top,
              filter: "saturate(78%) hue-rotate(8deg) brightness(112%) contrast(94%)",
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,183,213,0.22),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.16))]" />

      {markers.map(({ report, count, left, top, style, zoomScale }, index) => {
        const isEmergency = report.kind === "emergency";

        return (
          <div
            key={report.id}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left, top, transform: `translate(-50%, -50%) scale(${style.scale * zoomScale})` }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className={`absolute rounded-full opacity-20 blur-md ${isEmergency ? "bg-sos" : "bg-primary"}`}
                style={{ width: (66 + count * 6) * zoomScale, height: (66 + count * 6) * zoomScale }}
              />
              <div
                className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 text-lg font-black shadow-[0_14px_34px_hsl(240_70%_4%/0.22)] ${style.className}`}
              >
                {count}
              </div>
              <div className="absolute left-11 top-9 min-w-[8.4rem] rounded-2xl border border-primary/25 bg-[linear-gradient(135deg,rgba(255,247,252,0.96),rgba(246,236,255,0.94))] px-2.5 py-2 shadow-[0_12px_28px_rgba(84,38,130,0.22)] backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${isEmergency ? "bg-sos" : "bg-primary"}`} />
                  <p className="truncate text-[10px] font-black text-primary">
                    {getReportTitle(report, language)}
                  </p>
                </div>
                <p className="mt-0.5 text-[9px] font-bold text-[#7b5aa6]">
                  {copyFor(language, `Demo cluster ${index + 1}`, `演示聚合 ${index + 1}`)}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={{ left: userMarker.left, top: userMarker.top }}
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute h-11 w-11 animate-pulse rounded-full bg-sos-success/20" />
          <div className="relative h-4 w-4 rounded-full border-2 border-white bg-sos-success shadow-[0_0_0_6px_hsl(145_68%_44%/0.20)]" />
          <div className="absolute left-4 top-4 whitespace-nowrap rounded-full border border-sos-success/30 bg-white/92 px-2 py-1 text-[9px] font-black text-sos-success shadow-[0_8px_20px_rgba(18,119,75,0.2)] backdrop-blur">
            {copyFor(language, "You", "你的位置")}
          </div>
        </div>
      </div>

      <div
        className="absolute right-3 top-3 z-30 flex flex-col overflow-hidden rounded-2xl border border-border bg-card/90 shadow-lg backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onPointerCancel={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleZoom(zoom + 1);
          }}
          className="flex h-9 w-9 items-center justify-center border-b border-border text-foreground active:scale-95"
          aria-label={copyFor(language, "Zoom in", "放大")}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleZoom(zoom - 1);
          }}
          className="flex h-9 w-9 items-center justify-center text-foreground active:scale-95"
          aria-label={copyFor(language, "Zoom out", "缩小")}
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}

export default function MapPage({ language }: MapPageProps) {
  const geo = useGeoAlert(language);
  const coords = geo.coords ?? FALLBACK_COORDS;

  const rankedZones = useMemo(
    () => [...geo.alerts].sort((a, b) => b.count - a.count),
    [geo.alerts]
  );

  const reportMarkers = useMemo(() => geo.mapAlerts.slice(0, 5), [geo.mapAlerts]);
  const totalMapReports = Math.max(
    reportMarkers.reduce((sum, _report, index) => sum + (CLUSTER_DEMO_COUNTS[index] ?? 2), 0),
    rankedZones.reduce((sum, alert) => sum + alert.count, 0)
  );

  useEffect(() => {
    if (geo.status === "idle") void geo.refresh();
  }, [geo.status, geo.refresh]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">
            {copyFor(language, "Map", "地图")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "See nearby risk after anonymous reports are grouped into safe area zones, not exact locations.",
              "查看附近匿名上报聚合后的区域风险，不公开精确位置。"
            )}
          </p>
        </div>
        <button
          onClick={() => geo.refresh()}
          disabled={geo.status === "locating"}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-transform active:scale-95 disabled:opacity-50"
        >
          {geo.status === "locating" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {copyFor(language, "Refresh", "刷新")}
        </button>
      </header>

      <section className="space-y-3 rounded-[1.75rem] border border-border/80 bg-card/88 p-4 shadow-[0_16px_42px_hsl(240_70%_4%/0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-foreground">
              {copyFor(language, "Alert Map", "预警地图")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copyFor(
                language,
                "Demo reports stay connected to real map coordinates, but public view shows grouped areas only.",
                "演示上报跟随真实地图坐标移动，但公开视图只显示聚合区域。"
              )}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {copyFor(language, `${totalMapReports} reports`, `${totalMapReports} 条上报`)}
          </span>
        </div>

        {geo.status === "idle" && (
          <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-4">
            <button
              onClick={() => geo.refresh()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-black text-primary-foreground transition-transform active:scale-95"
            >
              <MapPin className="h-4 w-4" />
              {copyFor(language, "Load Nearby Map", "获取附近地图")}
            </button>
            <button
              onClick={() => geo.refresh(true)}
              className="w-full rounded-2xl border border-border bg-card py-3 text-xs font-semibold text-muted-foreground transition-transform active:scale-95"
            >
              {copyFor(language, "Load Demo Map", "加载演示地图")}
            </button>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              {copyFor(
                language,
                "Location is used only for anonymous area clustering, not exact public tracking.",
                "定位仅用于匿名区域聚合，不会公开精确追踪。"
              )}
            </p>
          </div>
        )}

        {geo.status === "locating" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {copyFor(language, "Loading nearby alert map...", "正在加载附近预警地图...")}
            </p>
          </div>
        )}

        {geo.status === "error" && (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center">
            <TriangleAlert className="mx-auto h-6 w-6 text-primary" />
            <p className="text-sm text-foreground">{geo.error}</p>
            <button onClick={() => geo.refresh(true)} className="text-xs font-semibold text-primary underline">
              {copyFor(language, "Use demo data", "改用演示数据")}
            </button>
          </div>
        )}

        {geo.status === "done" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <DemoTileMap center={coords} reports={reportMarkers} language={language} />

              <div className="mx-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-[10px] text-muted-foreground shadow-sm">
                <span className="font-bold text-foreground">
                  {copyFor(language, "Color legend", "颜色图例")}
                </span>
                {["7+", "5-6", "4", "3", "2"].map((label, index) => (
                  <span key={label} className="inline-flex items-center gap-1">
                    <span className={`h-2.5 w-2.5 rounded-full border ${depthStyles[index]}`} />
                    <span>
                      {label} {copyFor(language, "requests", "条")}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {rankedZones.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-background/70 py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 text-sos-success" />
                <p className="text-sm font-bold text-sos-success">
                  {copyFor(language, "Demo reports are shown above", "上方已显示演示上报")}
                </p>
                <p className="px-5 text-center text-xs leading-5">
                  {copyFor(
                    language,
                    "Aggregated risk zones appear after repeated trusted reports in the same anonymous area.",
                    "同一匿名区域出现多次可信上报后，会在这里形成统计后的风险区域。"
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankedZones.map((alert) => (
                  <div key={alert.zoneHash} className={`space-y-2 rounded-2xl border p-4 ${riskBg(alert.riskLevel)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-foreground">
                          {riskLabel(alert.riskLevel, language)}
                          {alert.isSameZone && (
                            <span className="ml-2 text-xs font-semibold text-primary">
                              {copyFor(language, "Current area", "当前区域")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {copyFor(
                            language,
                            "Anonymous clustered help requests in the last 7 days",
                            "近 7 天匿名聚合后的求助统计"
                          )}
                        </p>
                      </div>
                      <div className="rounded-full bg-background/70 px-3 py-1 text-xs font-bold text-foreground">
                        {alert.count} {copyFor(language, "requests", "条")}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {copyFor(language, "Updated", "最近更新")} {timeAgo(alert.latestAt, language)}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground/60">Zone ID: {alert.zoneHash}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
}
