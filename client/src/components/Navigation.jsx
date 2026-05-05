import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './Navigation.module.css';

const TRAVEL_MODES = [
  { value: 'WALKING',   label: 'Walk' },
  { value: 'DRIVING',   label: 'Drive' },
  { value: 'TRANSIT',   label: 'Transit' },
  { value: 'BICYCLING', label: 'Bike' },
];

export default function Navigation({ map, userLocation, destination, destinationName, onClose, onNavStateChange }) {
  const directionsRendererRef = useRef(null);
  const [travelMode, setTravelMode] = useState('WALKING');
  const [steps, setSteps]           = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Init DirectionsRenderer once
  useEffect(() => {
    if (!map || !window.google) return;
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#6366f1',
        strokeWeight: 5,
        strokeOpacity: 0.9,
      },
    });
    return () => {
      directionsRendererRef.current?.setMap(null);
    };
  }, [map]);

  const fetchRoute = useCallback(() => {
    if (!map || !window.google || !userLocation || !destination) return;

    setLoading(true);
    setError(null);
    setCurrentStep(0);

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: userLocation,
        destination,
        travelMode: window.google.maps.TravelMode[travelMode],
      },
      (result, status) => {
        setLoading(false);
        if (status === 'OK') {
          directionsRendererRef.current?.setDirections(result);
          const leg = result.routes[0].legs[0];
          const newSummary = {
            distance: leg.distance.text,
            duration: leg.duration.text,
          };
          const newSteps = leg.steps.map((s) => ({
            instruction: s.instructions.replace(/<[^>]*>/g, ''),
            distance: s.distance.text,
            duration: s.duration.text,
            maneuver: s.maneuver || '',
            // end_location is a LatLng object from Google Maps API
            endLocation: s.end_location
              ? { lat: s.end_location.lat(), lng: s.end_location.lng() }
              : null,
          }));
          setSummary(newSummary);
          setSteps(newSteps);
          // Notify parent of nav state
          onNavStateChange?.({
            steps: newSteps,
            currentStep: 0,
            summary: newSummary,
            destinationName,
          });
        } else {
          setError(`Could not find a route (${status}). Try a different travel mode.`);
        }
      }
    );
  }, [map, userLocation, destination, travelMode]);

  // Auto-fetch when destination or mode changes
  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // Speak current step
  const speakStep = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  };

  const goToStep = (index) => {
    setCurrentStep(index);
    speakStep(steps[index]?.instruction);
    onNavStateChange?.({ steps, currentStep: index, summary, destinationName });
  };

  const maneuverIcon = (maneuver) => {
    if (maneuver.includes('left'))  return '↰';
    if (maneuver.includes('right')) return '↱';
    if (maneuver.includes('straight') || maneuver === '') return '↑';
    if (maneuver.includes('uturn')) return '↩';
    if (maneuver.includes('roundabout')) return '↻';
    return '•';
  };

  if (!destination) return null;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.destLabel}>Navigating to</p>
          <p className={styles.destName}>{destinationName}</p>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close navigation">✕</button>
      </div>

      {/* Travel mode selector */}
      <div className={styles.modes}>
        {TRAVEL_MODES.map((m) => (
          <button
            key={m.value}
            className={`${styles.modeBtn} ${travelMode === m.value ? styles.modeBtnActive : ''}`}
            onClick={() => setTravelMode(m.value)}
            aria-pressed={travelMode === m.value}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {summary && (
        <div className={styles.summary}>
          <span className={styles.summaryItem}>{summary.distance}</span>
          <span className={styles.summaryDivider}>·</span>
          <span className={styles.summaryItem}>{summary.duration}</span>
        </div>
      )}

      {loading && <p className={styles.loading}>Finding route...</p>}
      {error   && <p className={styles.error}>{error}</p>}

      {/* Step-by-step */}
      {steps.length > 0 && (
        <div className={styles.steps}>
          <div className={styles.stepsHeader}>
            <span className={styles.stepsTitle}>Directions</span>
            <button
              className={styles.speakBtn}
              onClick={() => speakStep(steps[currentStep]?.instruction)}
              aria-label="Read current step aloud"
            >
              Read aloud
            </button>
          </div>

          <ul className={styles.stepList} aria-label="Navigation steps">
            {steps.map((step, i) => (
              <li
                key={i}
                className={`${styles.step} ${i === currentStep ? styles.stepActive : ''}`}
                onClick={() => goToStep(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && goToStep(i)}
                aria-current={i === currentStep ? 'step' : undefined}
              >
                <span className={styles.stepIcon} aria-hidden="true">
                  {maneuverIcon(step.maneuver)}
                </span>
                <span className={styles.stepText}>{step.instruction}</span>
                <span className={styles.stepDist}>{step.distance}</span>
              </li>
            ))}
            <li className={styles.stepDestination}>
              <span className={styles.stepIcon}>[ ]</span>
              <span className={styles.stepText}>Arrive at {destinationName}</span>
            </li>
          </ul>

          {/* Prev / Next controls */}
          <div className={styles.stepNav}>
            <button
              className={styles.stepNavBtn}
              onClick={() => goToStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              aria-label="Previous step"
            >
              ← Prev
            </button>
            <span className={styles.stepCounter}>{currentStep + 1} / {steps.length}</span>
            <button
              className={styles.stepNavBtn}
              onClick={() => goToStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              aria-label="Next step"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
