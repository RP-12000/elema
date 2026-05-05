import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import axios from 'axios';
import Navigation from './Navigation';
import AccessibilityPanel from './AccessibilityPanel';
import styles from './Map.module.css';

const GOOGLE_MAPS_KEY = 'AIzaSyDn4_Ty8eOo6p5ZXWPyd8NmCp0b_IXzpoc';

export default function Map({
  onRestaurantsFound, onSelectRestaurant,
  restaurants, userLocation,
  loading, setLoading,
  desktopMode, navigationTarget, onClearNavigation, onNavStateChange,
  allergens, onAddAllergen, onRemoveAllergen,
}) {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const markersRef      = useRef([]);
  const userMarkerRef   = useRef(null);

  const [error, setError]           = useState(null);
  const [radius, setRadius]         = useState(1500);
  const [mapReady, setMapReady]     = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [navState, setNavState]     = useState(null);
  const [blindAssistOn, setBlindAssistOn] = useState(false);

  // Internal nav state (can be set from map marker click too)
  const [navTarget, setNavTarget]   = useState(null);

  // Sync external navigationTarget prop → internal state
  useEffect(() => {
    if (navigationTarget) setNavTarget(navigationTarget);
  }, [navigationTarget]);

  // ── Init map ──────────────────────────────────────────────
  useEffect(() => {
    const loader = new Loader({
      apiKey: GOOGLE_MAPS_KEY,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      if (!mapRef.current) return;
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER,
        },
      });
      setMapReady(true);

      // Auto-locate
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            mapInstanceRef.current.setCenter(loc);
            mapInstanceRef.current.setZoom(15);
            placeUserMarker(loc);
          },
          () => {}
        );
      }
    }).catch((err) => {
      console.error('Google Maps load error:', err);
      setError('Failed to load Google Maps. Check your API key.');
    });
  }, []);

  const placeUserMarker = (location) => {
    if (!mapInstanceRef.current || !window.google) return;
    if (userMarkerRef.current) userMarkerRef.current.setMap(null);
    userMarkerRef.current = new window.google.maps.Marker({
      position: location,
      map: mapInstanceRef.current,
      title: 'You are here',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      zIndex: 999,
    });
  };

  // ── Restaurant markers ────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    restaurants.forEach((r) => {
      const marker = new window.google.maps.Marker({
        position: r.location,
        map: mapInstanceRef.current,
        title: r.name,
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/restaurant.png',
          scaledSize: new window.google.maps.Size(32, 32),
        },
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="max-width:200px;font-family:sans-serif">
            <strong style="font-size:14px">${r.name}</strong><br/>
            ⭐ ${r.rating ?? 'N/A'} · ${getPriceLabel(r.priceLevel)}<br/>
            ${r.openNow ? '🟢 Open now' : '🔴 Closed'}<br/>
            <button
              onclick="window.__navigateTo('${r.id}','${r.name.replace(/'/g, "\\'")}',${r.location.lat},${r.location.lng})"
              style="margin-top:8px;padding:5px 12px;background:#ff6b35;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600"
            >🧭 Navigate</button>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        onSelectRestaurant(r);
      });

      markersRef.current.push(marker);
    });

    // Global callback for the Navigate button inside InfoWindow HTML
    window.__navigateTo = (id, name, lat, lng) => {
      setNavTarget({ location: { lat: parseFloat(lat), lng: parseFloat(lng) }, name });
    };
  }, [restaurants, onSelectRestaurant]);

  // ── Search nearby ─────────────────────────────────────────
  const searchNearby = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const location = { lat, lng };

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(location);
          mapInstanceRef.current.setZoom(15);
          placeUserMarker(location);
        }

        try {
          const { data } = await axios.get('/api/places/nearby', {
            params: { lat, lng, radius },
          });
          onRestaurantsFound(data.restaurants, location);
        } catch (err) {
          setError('Failed to fetch restaurants. Is the server running?');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Location access denied. Please allow location access.');
        setLoading(false);
      }
    );
  };

  const closeNavigation = () => {
    setNavTarget(null);
    setNavState(null);
    onClearNavigation?.();
  };

  return (
    <div className={`${styles.container} ${desktopMode ? styles.containerDesktop : ''} ${highContrast ? styles.highContrast : ''}`}>
      {/* Search bar */}
      <div className={styles.controls}>
        <select
          className={styles.radiusSelect}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-label="Search radius"
        >
          <option value={500}>500m</option>
          <option value={1000}>1 km</option>
          <option value={1500}>1.5 km</option>
          <option value={2000}>2 km</option>
          <option value={5000}>5 km</option>
        </select>
        <button
          className={styles.searchBtn}
          onClick={searchNearby}
          disabled={loading}
          aria-label="Search for nearby restaurants"
        >
          {loading ? '⏳ Searching...' : '📍 Find Nearby Restaurants'}
        </button>
      </div>

      {error && (
        <div className={styles.error} role="alert">⚠️ {error}</div>
      )}

      {/* Map */}
      <div className={styles.mapWrapper}>
        <div ref={mapRef} className={styles.map} aria-label="Google Map" />

        {/* Accessibility button — top-right corner of map */}
        <div className={styles.accessibilityBtn}>
          <AccessibilityPanel
            highContrast={highContrast}
            onHighContrast={setHighContrast}
            navState={navState}
            onBlindAssistChange={setBlindAssistOn}
            allergens={allergens}
            onAddAllergen={onAddAllergen}
            onRemoveAllergen={onRemoveAllergen}
          />
        </div>

        {/* Navigation panel — hidden while Blind Assist overlay is open */}
        {navTarget && mapReady && !blindAssistOn && (
          <div className={styles.navPanel}>
            <Navigation
              map={mapInstanceRef.current}
              userLocation={userLocation}
              destination={navTarget.location}
              destinationName={navTarget.name}
              onClose={closeNavigation}
              onNavStateChange={setNavState}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function getPriceLabel(level) {
  if (level == null) return 'Price N/A';
  return ['Free', '$', '$$', '$$$', '$$$$'][level] ?? 'N/A';
}
