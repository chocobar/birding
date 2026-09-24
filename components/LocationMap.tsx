'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon paths (broken by bundlers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name: string;
  typeLabel: string;
  distance: number;
  routeGeometry?: [number, number][];
}

function FitRouteBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 1) {
      const bounds = L.latLngBounds(positions.map((p) => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [map, positions]);

  return null;
}

function RoutePopup({ name, typeLabel, distanceText }: { name: string; typeLabel: string; distanceText: string }) {
  return (
    <Popup className="location-popup">
      <div className="text-sm">
        <strong className="block text-base mb-1">{name}</strong>
        <span className="text-[var(--text-secondary)]">{typeLabel}</span>
        <span className="block text-[var(--text-secondary)] mt-0.5">{distanceText}</span>
      </div>
    </Popup>
  );
}

export default function LocationMap({ latitude, longitude, name, typeLabel, distance, routeGeometry }: LocationMapProps) {
  const distanceText = distance < 1
    ? `${Math.round(distance * 1760)} yards away`
    : `${distance.toFixed(1)} miles away`;

  const hasRoute = routeGeometry && routeGeometry.length > 1;

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      className="w-full h-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {hasRoute ? (
        <>
          <Polyline
            positions={routeGeometry!}
            pathOptions={{ color: '#2b7a4b', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
          >
            <RoutePopup name={name} typeLabel={typeLabel} distanceText={distanceText} />
          </Polyline>
          <FitRouteBounds positions={routeGeometry!} />
        </>
      ) : (
        <Marker position={[latitude, longitude]}>
          <RoutePopup name={name} typeLabel={typeLabel} distanceText={distanceText} />
        </Marker>
      )}
    </MapContainer>
  );
}
