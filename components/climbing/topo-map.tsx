"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import { OSM_ATTRIBUTION, OSM_MAX_ZOOM, OSM_TILES } from "@/lib/integrations/outdoor/osm";

/**
 * Boulders on an OpenStreetMap background (Leaflet). Load it with next/dynamic
 * and ssr: false, only once the climber asks for the map: neither Leaflet nor
 * any tile is fetched before that.
 *
 * OSM tile usage policy: attribution shown, the browser sends the Referer
 * (strict-origin-when-cross-origin), no prefetching or bulk download, and tiles
 * are left to the browser cache (public/sw.js only handles navigations).
 */

export type MapPin = {
  id: number;
  lat: number;
  lon: number;
  /** Swatch colours; the text is the circuit number (or the grade off-circuit). */
  bg: string;
  fg: string;
  text: string;
  /** Read by screen readers and shown as a tooltip: "Bleu 12 · La Roseline · 4c". */
  label: string;
};

function pinElement(pin: MapPin, selected: boolean): HTMLElement {
  // Built with DOM nodes, never an HTML string: topo names come from uploaded files.
  const el = document.createElement("span");
  el.className = selected
    ? "flex h-9 min-w-9 items-center justify-center rounded-full px-1 text-xs font-black tabular-nums shadow-lg ring-4 ring-accent"
    : "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums shadow ring-2 ring-white";
  el.style.backgroundColor = pin.bg;
  el.style.color = pin.fg;
  el.textContent = pin.text;
  return el;
}

export default function TopoMap({
  pins,
  selectedId,
  onSelect,
  label,
  className,
}: {
  pins: MapPin[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  label: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !box.current) return;
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      lib.current = L;
      const m = L.map(box.current, { scrollWheelZoom: false, zoomSnap: 0.5 });
      L.tileLayer(OSM_TILES, { maxZoom: OSM_MAX_ZOOM, attribution: OSM_ATTRIBUTION }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Frame the boulders whenever the set shown changes (a circuit filter, a search).
  const frame = pins.map((p) => p.id).join(",");
  useEffect(() => {
    const L = lib.current;
    const m = map.current;
    if (!ready || !L || !m || pins.length === 0) return;
    if (pins.length === 1) m.setView([pins[0].lat, pins[0].lon], 18);
    else m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number])), { padding: [28, 28], maxZoom: OSM_MAX_ZOOM });
    // pins is read through `frame`: re-framing on a selection change would make the map jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, frame]);

  useEffect(() => {
    const L = lib.current;
    const group = layer.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    for (const pin of pins) {
      const selected = pin.id === selectedId;
      const marker = L.marker([pin.lat, pin.lon], {
        icon: L.divIcon({ html: pinElement(pin, selected), className: "", iconSize: selected ? [36, 36] : [28, 28] }),
        keyboard: true,
        title: pin.label,
        zIndexOffset: selected ? 1000 : 0,
        riseOnHover: true,
      });
      marker.on("click", () => select.current?.(pin.id));
      marker.addTo(group);
      const el = marker.getElement();
      if (el) {
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", pin.label);
        if (selected) el.setAttribute("aria-pressed", "true");
      }
    }
  }, [ready, pins, selectedId]);

  // isolate: keeps Leaflet's z-indexes (400+) under the app's header and bottom bar.
  return <div ref={box} role="region" aria-label={label} className={`isolate ${className ?? "h-80 w-full overflow-hidden rounded-2xl border border-line"}`} />;
}
