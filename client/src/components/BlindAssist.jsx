import React, { useRef, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from './BlindAssist.module.css';

// VITE_SCAN_INTERVAL: seconds between each scan (default 3)
// e.g. VITE_SCAN_INTERVAL=1 → scan every 1 second
const SCAN_INTERVAL = Math.round((parseFloat(import.meta.env.VITE_SCAN_INTERVAL) || 3) * 1000);

// After 1 consecutive "clear" result, stop repeating "Path is clear"
const CLEAR_SILENCE_AFTER = 1;

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
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);
  const clearCountRef = useRef(0); // consecutive clear count

  const [isActive, setIsActive]           = useState(false);
  const [result, setResult]               = useState(null);
  const [error, setError]                 = useState(null);
  const [scanning, setScanning]           = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);

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
    const imageData = canvas.toDataURL('image/jpeg', 0.55);

    setScanning(true);
    try {
      const { data } = await axios.post('/api/vision/detect-obstacles', { image: imageData });
      setResult(data);

      const isClear = !data.hasObstacle || data.severity === 'none';

      if (!isClear) {
        // Obstacle — always speak, reset clear counter
        speak(data.action);
        clearCountRef.current = 0;
      } else {
        clearCountRef.current += 1;
        if (clearCountRef.current <= CLEAR_SILENCE_AFTER) {
          // Announce "clear" only on the first transition
          speak('Path is clear.');
        }
        // After CLEAR_SILENCE_AFTER consecutive clears: stay silent
      }
    } catch (err) {
      console.error('Vision error:', err);
    } finally {
      setScanning(false);
    }
  }, [speak]);

  // ── Start/stop interval when active ─────────────────────
  useEffect(() => {
    if (!isActive) return;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(captureAndAnalyze, SCAN_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [captureAndAnalyze, isActive]);

  // ── GPS-based step auto-advance ──────────────────────────
  useEffect(() => {
    if (!isActive || !navState?.steps?.length) return;

    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const steps   = navState.steps;
        const idx     = navState.currentStep;

        if (idx >= steps.length - 1) return;

        const step = steps[idx];
        if (!step?.endLocation) return;

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
      clearCountRef.current = 0;
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

      {/* Navigation status bar */}
      {navState && (
        <div className={styles.navBar}>
          <div className={styles.navDest}>
            <span className={styles.navDestLabel}>Navigating to</span>
            <span className={styles.navDestName}>{navState.destinationName}</span>
          </div>
          {navState.summary && (
            <div className={styles.navSummary}>
              <span>{navState.summary.distance}</span>
              <span>{navState.summary.duration}</span>
            </div>
          )}
        </div>
      )}

      {/* Current step */}
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
          >
            Read
          </button>
        </div>
      )}

      {/* Step list */}
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
            <span className={styles.stepRowIcon}>[ ]</span>
            <span className={styles.stepRowText}>Arrive at {navState.destinationName}</span>
          </div>
        </div>
      )}

      {/* Camera controls */}
      <div className={styles.controls}>
        <button
          className={`${styles.toggleBtn} ${isActive ? styles.stopBtn : styles.startBtn}`}
          onClick={isActive ? stopCamera : startCamera}
          aria-label={isActive ? 'Stop obstacle detection' : 'Start obstacle detection'}
        >
          {isActive ? 'Stop Camera' : 'Start Camera'}
        </button>
        <button
          className={`${styles.speechBtn} ${speechEnabled ? styles.speechOn : styles.speechOff}`}
          onClick={() => setSpeechEnabled(!speechEnabled)}
          aria-pressed={speechEnabled}
          aria-label={speechEnabled ? 'Mute speech' : 'Unmute speech'}
        >
          {speechEnabled ? 'Sound On' : 'Sound Off'}
        </button>
      </div>

      {/* Scan rate indicator */}
      {isActive && (
        <div className={styles.scanRate}>
          Scanning every {SCAN_INTERVAL / 1000}s
          {isClearResult ? ' — path clear' : ' — obstacle detected'}
        </div>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}

      {/* Camera feed */}
      <div className={styles.cameraWrapper}>
        <video ref={videoRef} className={styles.video} playsInline muted aria-label="Camera feed" />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        {!isActive && <div className={styles.cameraPlaceholder}>Camera inactive</div>}
        {scanning && <div className={styles.scanningBadge} aria-live="polite">Scanning...</div>}
      </div>

      {/* Obstacle result */}
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
              {result.hasObstacle ? 'Obstacle Detected' : 'Path Clear'}
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
