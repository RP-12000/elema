import React, { useRef, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from './BlindAssist.module.css';

// Scan intervals
const INTERVAL_OBSTACLE = 2000;  // obstacle detected → scan every 2s
const INTERVAL_CLEAR    = 6000;  // path clear → scan every 6s (save API calls)

// How close (metres) to a step's end location before auto-advancing
const STEP_ADVANCE_RADIUS = 25;

const MANEUVER_ICON = (m = '') => {
  if (m.includes('left'))       return '↰';
  if (m.includes('right'))      return '↱';
  if (m.includes('uturn'))      return '↩';
  if (m.includes('roundabout')) return '↻';
  return '↑';
};

function haversineMetres(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function BlindAssist({ navState, onStepAdvance }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef = useRef(null);
  const lastClearRef = useRef(false); // was last result clear?

  const [isActive, setIsActive]           = useState(false);
  const [result, setResult]               = useState(null);
  const [error, setError]                 = useState(null);
  const [scanning, setScanning]           = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [currentInterval, setCurrentInterval] = useState(INTERVAL_CLEAR);

  // ── Speech ──────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }, [speechEnabled]);

  // ── Capture & analyse one frame ─────────────────────────
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.55); // slightly lower quality = smaller payload

    setScanning(true);
    try {
      const { data } = await axios.post('/api/vision/detect-obstacles', { image: imageData });
      setResult(data);

      const isClear = !data.hasObstacle || data.severity === 'none';

      // Only speak when:
      //  • there IS an obstacle, OR
      //  • path just became clear after an obstacle (one-time "all clear")
      if (!isClear) {
        speak(data.action);
      } else if (!lastClearRef.current) {
        // Transition: obstacle → clear → say it once
        speak('Path is clear.');
      }
      // If was already clear last scan, stay silent

      lastClearRef.current = isClear;

      // Adjust next interval based on result
      const nextInterval = isClear ? INTERVAL_CLEAR : INTERVAL_OBSTACLE;
      setCurrentInterval(nextInterval);

    } catch (err) {
      console.error('Vision error:', err);
    } finally {
      setScanning(false);
    }
  }, [speak]);

  // ── Restart interval whenever interval duration changes ──
  useEffect(() => {
    if (!isActive) return;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(captureAndAnalyze, currentInterval);
    return () => clearInterval(intervalRef.current);
  }, [captureAndAnalyze, isActive, currentInterval]);

  // ── GPS-based step auto-advance ──────────────────────────
  useEffect(() => {
    if (!isActive || !navState?.steps?.length) return;

    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const steps   = navState.steps;
        const idx     = navState.currentStep;

        if (idx >= steps.length - 1) return; // already at last step

        const step = steps[idx];
        if (!step?.endLocation) return; // no end location data

        const dist = haversineMetres(userPos, step.endLocation);
        if (dist < STEP_ADVANCE_RADIUS) {
          const nextStep = steps[idx + 1];
          onStepAdvance?.(idx + 1);
          speak(`Navigation: ${nextStep.instruction}`);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation?.clearWatch(watchId);
  }, [isActive, navState, speak, onStepAdvance]);

  // ── Speak step when manually changed ────────────────────
  const prevStepRef = useRef(null);
  useEffect(() => {
    if (!navState?.steps?.length || !isActive) return;
    const idx = navState.currentStep;
    if (idx !== prevStepRef.current) {
      prevStepRef.current = idx;
      const step = navState.steps[idx];
      if (step) speak(`Step ${idx + 1}: ${step.instruction}`);
    }
  }, [navState?.currentStep, isActive, speak]);

  // ── Camera start / stop ──────────────────────────────────
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      lastClearRef.current = false;
      setIsActive(true);
      speak('Blind assist activated.');
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('Camera access denied.');
      else if (err.name === 'NotFoundError') setError('No camera found on this device.');
      else setError(`Camera error: ${err.message}`);
    }
  };

  const stopCamera = () => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    setResult(null);
    window.speechSynthesis?.cancel();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Severity colours ─────────────────────────────────────
  const severityColor = {
    none:   'var(--green)',
    low:    '#86efac',
    medium: '#fbbf24',
    high:   'var(--red)',
  };

  const currentNavStep = navState?.steps?.[navState.currentStep];
  const isClearResult  = result && (!result.hasObstacle || result.severity === 'none');

  return (
    <div className={styles.container}>

      {/* ── Navigation status bar ── */}
      {navState && (
        <div className={styles.navBar}>
          <div className={styles.navDest}>
            <span className={styles.navDestLabel}>Navigating to</span>
            <span className={styles.navDestName}>{navState.destinationName}</span>
          </div>
          {navState.summary && (
            <div className={styles.navSummary}>
              <span>📏 {navState.summary.distance}</span>
              <span>⏱ {navState.summary.duration}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Current step ── */}
      {currentNavStep && (
        <div className={styles.currentStep}>
          <span className={styles.currentStepIcon} aria-hidden="true">
            {MANEUVER_ICON(currentNavStep.maneuver)}
          </span>
          <div className={styles.currentStepBody}>
            <p className={styles.currentStepText}>{currentNavStep.instruction}</p>
            <p className={styles.currentStepDist}>{currentNavStep.distance}</p>
          </div>
          <button
            className={styles.speakStepBtn}
            onClick={() => speak(currentNavStep.instruction)}
            aria-label="Read step aloud"
          >🔊</button>
        </div>
      )}

      {/* ── Step list ── */}
      {navState?.steps?.length > 0 && (
        <div className={styles.stepList}>
          {navState.steps.map((s, i) => (
            <div
              key={i}
              className={`${styles.stepRow} ${i === navState.currentStep ? styles.stepRowActive : ''}`}
            >
              <span className={styles.stepRowIcon}>{MANEUVER_ICON(s.maneuver)}</span>
              <span className={styles.stepRowText}>{s.instruction}</span>
              <span className={styles.stepRowDist}>{s.distance}</span>
            </div>
          ))}
          <div className={styles.stepRow}>
            <span className={styles.stepRowIcon}>🏁</span>
            <span className={styles.stepRowText}>Arrive at {navState.destinationName}</span>
          </div>
        </div>
      )}

      {/* ── Camera controls ── */}
      <div className={styles.controls}>
        <button
          className={`${styles.toggleBtn} ${isActive ? styles.stopBtn : styles.startBtn}`}
          onClick={isActive ? stopCamera : startCamera}
          aria-label={isActive ? 'Stop obstacle detection' : 'Start obstacle detection'}
        >
          {isActive ? '⏹ Stop Camera' : '📷 Start Camera'}
        </button>
        <button
          className={`${styles.speechBtn} ${speechEnabled ? styles.speechOn : styles.speechOff}`}
          onClick={() => setSpeechEnabled(!speechEnabled)}
          aria-pressed={speechEnabled}
        >
          {speechEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* Scan rate indicator */}
      {isActive && (
        <div className={styles.scanRate}>
          {isClearResult
            ? `🟢 Path clear — scanning every ${INTERVAL_CLEAR / 1000}s`
            : `🔴 Obstacle — scanning every ${INTERVAL_OBSTACLE / 1000}s`}
        </div>
      )}

      {error && <div className={styles.error} role="alert">⚠️ {error}</div>}

      {/* ── Camera feed ── */}
      <div className={styles.cameraWrapper}>
        <video ref={videoRef} className={styles.video} playsInline muted aria-label="Camera feed" />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        {!isActive && <div className={styles.cameraPlaceholder}>📷 Camera inactive</div>}
        {scanning && <div className={styles.scanningBadge} aria-live="polite">🔍 Scanning...</div>}
      </div>

      {/* ── Obstacle result ── */}
      {result && (
        <div
          className={styles.result}
          style={{ borderColor: severityColor[result.severity] || 'var(--border)' }}
          role="status"
          aria-live="polite"
        >
          <div className={styles.resultHeader}>
            <span
              className={styles.severityDot}
              style={{ background: severityColor[result.severity] }}
              aria-hidden="true"
            />
            <span className={styles.severityLabel}>
              {result.hasObstacle ? '⚠️ Obstacle Detected' : '✅ Path Clear'}
            </span>
          </div>
          <p className={styles.action}>{result.action}</p>
          {result.obstacleType && <p className={styles.detail}>Type: {result.obstacleType}</p>}
          {result.distance     && <p className={styles.detail}>Distance: {result.distance}</p>}
        </div>
      )}
    </div>
  );
}
