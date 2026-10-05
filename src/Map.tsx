import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Business } from "./model";
import { verifyLink } from "./model";
export function BusinessMap({
  businesses,
  onView,
}: {
  businesses: Business[];
  onView: (b: Business) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current).setView([9.08, 8.67], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const points: L.LatLngExpression[] = [];
    businesses
      .filter(
        (b) => Number.isFinite(b.latitude) && Number.isFinite(b.longitude),
      )
      .forEach((b) => {
        const p: [number, number] = [b.latitude, b.longitude];
        points.push(p);
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = b.name || "Not Available";
        popup.append(title);
        const info = document.createElement("p");
        info.textContent = `${b.category} · ${b.leadScore}/100\n${b.websiteStatus}\n${b.phone || "Not Available"}`;
        popup.append(info);
        const button = document.createElement("button");
        button.textContent = "View Lead";
        button.onclick = () => onView(b);
        popup.append(button);
        const link = document.createElement("a");
        link.textContent = " Verify Online ↗";
        link.href = verifyLink(b);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        popup.append(link);
        L.circleMarker(p, {
          radius: 8,
          color: "#fff",
          weight: 2,
          fillColor:
            b.websiteStatus === "No Website Found" ? "#c08138" : "#287c60",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(popup);
      });
    if (points.length)
      map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 15 });
    return () => {
      map.remove();
    };
  }, [businesses, onView]);
  return <div className="map" ref={ref} aria-label="Business locations map" />;
}
