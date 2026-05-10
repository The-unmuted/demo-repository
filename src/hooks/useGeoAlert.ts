import { useState, useCallback } from "react";
import { getMapAlertRecords, getNearbyAlerts, seedDemoAlerts, type AlertZone, type MapAlertRecord } from "@/lib/geoAlert";
import { AppLanguage, copyFor } from "@/lib/locale";

type GeoStatus = "idle" | "locating" | "done" | "error";

const FALLBACK_DEMO_COORDS = { lat: 31.2304, lng: 121.4737 };

export function useGeoAlert(language: AppLanguage = "zh") {
  const [status, setStatus]   = useState<GeoStatus>("idle");
  const [alerts, setAlerts]   = useState<AlertZone[]>([]);
  const [mapAlerts, setMapAlerts] = useState<MapAlertRecord[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [coords, setCoords]   = useState<{ lat: number; lng: number } | null>(null);

  const refresh = useCallback(async (demo = false) => {
    setStatus("locating");
    setError(null);

    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve, reject) => {
        if (!navigator.geolocation) {
          if (demo) resolve(null);
          else reject(new Error("Geolocation unavailable"));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, (err) => {
          if (demo) resolve(null);
          else reject(err);
        }, {
          enableHighAccuracy: false,
          timeout: 8000,
        });
      });
      const lat = pos?.coords.latitude ?? FALLBACK_DEMO_COORDS.lat;
      const lng = pos?.coords.longitude ?? FALLBACK_DEMO_COORDS.lng;
      setCoords({ lat, lng });

      if (demo) await seedDemoAlerts(lat, lng);

      const result = await getNearbyAlerts(lat, lng);
      setAlerts(result);
      setMapAlerts(getMapAlertRecords(lat, lng));
      setStatus("done");
    } catch (e) {
      setError(e instanceof GeolocationPositionError
        ? copyFor(language, "Could not get location. Please allow location access.", "无法获取位置，请允许定位权限")
        : copyFor(language, "Location failed", "定位失败"));
      setStatus("error");
    }
  }, [language]);

  return { status, alerts, mapAlerts, error, coords, refresh, setMapAlerts };
}
