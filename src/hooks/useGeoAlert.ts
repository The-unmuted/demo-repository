import { useState, useCallback } from "react";
import { getNearbyAlerts, seedDemoAlerts, type AlertZone } from "@/lib/geoAlert";

type GeoStatus = "idle" | "locating" | "done" | "error";

export function useGeoAlert() {
  const [status, setStatus]   = useState<GeoStatus>("idle");
  const [alerts, setAlerts]   = useState<AlertZone[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [coords, setCoords]   = useState<{ lat: number; lng: number } | null>(null);

  const refresh = useCallback(async (demo = false) => {
    setStatus("locating");
    setError(null);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
        })
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });

      if (demo) await seedDemoAlerts(lat, lng);

      const result = await getNearbyAlerts(lat, lng);
      setAlerts(result);
      setStatus("done");
    } catch (e) {
      setError(e instanceof GeolocationPositionError
        ? "无法获取位置，请允许定位权限"
        : "定位失败");
      setStatus("error");
    }
  }, []);

  return { status, alerts, error, coords, refresh };
}
