'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
}

export default function LocationMap({ latitude, longitude, name, typeLabel, distance }: LocationMapProps) {
  const distanceText = distance < 1
    ? `${Math.round(distance * 1760)} yards away`
    : `${distance.toFixed(1)} miles away`;

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
      <Marker position={[latitude, longitude]}>
        <Popup>
          <div className="text-sm">
            <strong className="block text-base mb-1">{name}</strong>
            <span className="text-gray-600">{typeLabel}</span>
            <span className="block text-gray-500 mt-0.5">{distanceText}</span>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}