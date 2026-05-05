import React, { useState, useRef, useEffect } from 'react';
import BlindAssist from './BlindAssist';
import styles from './AccessibilityPanel.module.css';

const COMMON_ALLERGENS = [
  'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 'Gluten',
  'Soy', 'Fish', 'Shellfish', 'Sesame',
];

const COLORBLIND_MODES = [
  { value: 'none',         label: 'Off' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'protanopia',   label: 'Protanopia' },
  { value: 'tritanopia',   label: 'Tritanopia' },
  { value: 'achromatopsia',label: 'Greyscale' },
];

const COLORBLIND_FILTERS = {
  none:          '',
  deuteranopia:  'url(#cb-deuteranopia)',
  protanopia:    'url(#cb-protanopia)',
  tritanopia:    'url(#cb-tritanopia)',
  achromatopsia: 'grayscale(1)',
};

export default function AccessibilityPanel({
  onHighContrast, highContrast,
  onBlindAssistChange, navState,
  allergens, onAddAllergen, onRemoveAllergen,
}) {
  const [open, setOpen]               = useState(false);
  const [blindAssistOn, setBlindAssistOn] = useState(false);
  const [fontScale, setFontScale]     = useState('normal');
  const [showOverlay, setShowOverlay] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');
  const [colorblindMode, setColorblindMode] = useState('none');
  const panelRef  = useRef(null);
  const inputRef  = useRef(null);

  const isNavigating = !!navState;

  useEffect(() => {
    if (!isNavigating && blindAssistOn) {
      setBlindAssistOn(false);
      setShowOverlay(false);
      onBlindAssistChange?.(false);
    }
  }, [isNavigating]);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Apply colorblind filter to the whole page
  useEffect(() => {
    const filter = COLORBLIND_FILTERS[colorblindMode] || '';
    document.documentElement.style.filter = filter;
    return () => { document.documentElement.style.filter = ''; };
  }, [colorblindMode]);

  const toggleBlindAssist = () => {
    if (!isNavigating) return;
    const next = !blindAssistOn;
    setBlindAssistOn(next);
    onBlindAssistChange?.(next);
    if (next) setShowOverlay(true);
    setOpen(false);
  };

  const closeOverlay = () => {
    setShowOverlay(false);
    setBlindAssistOn(false);
    onBlindAssistChange?.(false);
  };

  const FONT_SCALES = [
    { scale: 'small',  size: 12, aria: 'Small' },
    { scale: 'normal', size: 15, aria: 'Normal' },
    { scale: 'large',  size: 18, aria: 'Large' },
    { scale: 'xl',     size: 22, aria: 'Extra Large' },
  ];

  const handleFontScale = (scale) => {
    setFontScale(scale);
    document.body.setAttribute('data-font-scale', scale);
  };

  const handleAllergySubmit = (e) => {
    e.preventDefault();
    if (allergyInput.trim()) {
      onAddAllergen(allergyInput.trim());
      setAllergyInput('');
    }
  };

  return (
    <>
      {/* SVG filters for colorblind modes */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          {/* Deuteranopia (red-green, missing green) */}
          <filter id="cb-deuteranopia">
            <feColorMatrix type="matrix" values="
              0.625 0.375 0     0 0
              0.7   0.3   0     0 0
              0     0.3   0.7   0 0
              0     0     0     1 0" />
          </filter>
          {/* Protanopia (red-green, missing red) */}
          <filter id="cb-protanopia">
            <feColorMatrix type="matrix" values="
              0.567 0.433 0     0 0
              0.558 0.442 0     0 0
              0     0.242 0.758 0 0
              0     0     0     1 0" />
          </filter>
          {/* Tritanopia (blue-yellow) */}
          <filter id="cb-tritanopia">
            <feColorMatrix type="matrix" values="
              0.95  0.05  0     0 0
              0     0.433 0.567 0 0
              0     0.475 0.525 0 0
              0     0     0     1 0" />
          </filter>
        </defs>
      </svg>

      <div className={styles.wrapper} ref={panelRef}>
        {/* Trigger */}
        <button
          className={`${styles.trigger} ${open ? styles.triggerActive : ''} ${blindAssistOn ? styles.triggerEnabled : ''}`}
          onClick={() => setOpen(!open)}
          aria-label="Accessibility options"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          ♿
          {allergens?.length > 0 && (
            <span className={styles.allergyDot} aria-label={`${allergens.length} allergens set`} />
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className={styles.panel} role="dialog" aria-label="Accessibility settings">
            <h3 className={styles.panelTitle}>Accessibility</h3>

            {/* ── Blind Assist ── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Blind Assist</p>
                  <p className={styles.sectionDesc}>
                    {isNavigating ? 'AI obstacle detection via camera' : 'Start navigation first to use'}
                  </p>
                </div>
                <button
                  className={`${styles.toggle} ${blindAssistOn ? styles.toggleOn : ''} ${!isNavigating ? styles.toggleDisabled : ''}`}
                  onClick={toggleBlindAssist}
                  disabled={!isNavigating}
                  aria-pressed={blindAssistOn}
                >
                  {blindAssistOn ? 'On' : 'Off'}
                </button>
              </div>
              {!isNavigating && (
                <p className={styles.disabledHint}>Navigate to a restaurant to use</p>
              )}
            </div>

            {/* ── Allergies ── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Allergies</p>
                  <p className={styles.sectionDesc}>Warn me on restaurant cards</p>
                </div>
              </div>

              {/* Quick-add common allergens */}
              <div className={styles.allergenQuick}>
                {COMMON_ALLERGENS.map((a) => {
                  const key = a.toLowerCase();
                  const active = allergens?.includes(key);
                  return (
                    <button
                      key={a}
                      className={`${styles.allergenChip} ${active ? styles.allergenChipActive : ''}`}
                      onClick={() => active ? onRemoveAllergen(key) : onAddAllergen(a)}
                      aria-pressed={active}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>

              {/* Custom input */}
              <form className={styles.allergenForm} onSubmit={handleAllergySubmit}>
                <input
                  ref={inputRef}
                  className={styles.allergenInput}
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  placeholder="Add custom allergen..."
                  aria-label="Add custom allergen"
                />
                <button
                  type="submit"
                  className={styles.allergenAddBtn}
                  disabled={!allergyInput.trim()}
                  aria-label="Add allergen"
                >
                  +
                </button>
              </form>

              {/* Active allergens */}
              {allergens?.length > 0 && (
                <div className={styles.allergenActive}>
                  {allergens.map((a) => (
                    <span key={a} className={styles.allergenTag}>
                      {a}
                      <button
                        className={styles.allergenRemove}
                        onClick={() => onRemoveAllergen(a)}
                        aria-label={`Remove ${a}`}
                      >x</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── High Contrast ── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>High Contrast</p>
                  <p className={styles.sectionDesc}>Increase color contrast</p>
                </div>
                <button
                  className={`${styles.toggle} ${highContrast ? styles.toggleOn : ''}`}
                  onClick={() => onHighContrast?.(!highContrast)}
                  aria-pressed={highContrast}
                >
                  {highContrast ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            {/* ── Colorblind Mode ── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionLabel}>Colorblind Mode</p>
                  <p className={styles.sectionDesc}>Adjust colors for color vision deficiency</p>
                </div>
              </div>
              <div className={styles.colorblindButtons}>
                {COLORBLIND_MODES.map(({ value, label }) => (
                  <button
                    key={value}
                    className={`${styles.colorblindBtn} ${colorblindMode === value ? styles.colorblindBtnActive : ''}`}
                    onClick={() => setColorblindMode(value)}
                    aria-pressed={colorblindMode === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Text Size ── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div><p className={styles.sectionLabel}>Text Size</p></div>
              </div>
              <div className={styles.fontButtons}>
                {FONT_SCALES.map(({ scale, size, aria }) => (
                  <button
                    key={scale}
                    className={`${styles.fontBtn} ${fontScale === scale ? styles.fontBtnActive : ''}`}
                    style={{ fontSize: size }}
                    onClick={() => handleFontScale(scale)}
                    aria-pressed={fontScale === scale}
                    aria-label={`Text size: ${aria}`}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Blind Assist overlay */}
      {showOverlay && (
        <div className={styles.blindOverlay} role="dialog" aria-label="Blind assist active">
          <div className={styles.blindOverlayHeader}>
            <span>Blind Assist</span>
            <button className={styles.blindCloseBtn} onClick={closeOverlay} aria-label="Close blind assist">x</button>
          </div>
          <div className={styles.blindOverlayContent}>
            <BlindAssist navState={navState} />
          </div>
        </div>
      )}
    </>
  );
}
