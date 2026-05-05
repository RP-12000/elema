import React, { useState, useCallback } from 'react';
import Map from './components/Map';
import RestaurantList from './components/RestaurantList';
import RestaurantDetail from './components/RestaurantDetail';
import { useAllergens } from './hooks/useAllergens';
import styles from './App.module.css';

export default function App() {
  const [restaurants, setRestaurants]               = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [userLocation, setUserLocation]             = useState(null);
  const [loading, setLoading]                       = useState(false);
  const [navigationTarget, setNavigationTarget]     = useState(null);
  const [mobileTab, setMobileTab]                   = useState('map');

  const { allergens, addAllergen, removeAllergen } = useAllergens();

  const handleRestaurantsFound = useCallback((data, location) => {
    setRestaurants(data);
    setUserLocation(location);
    setMobileTab('list');
  }, []);

  const handleSelectRestaurant = useCallback((restaurant) => {
    setSelectedRestaurant(restaurant);
    setMobileTab('list');
  }, []);

  const handleBack = useCallback(() => setSelectedRestaurant(null), []);

  const handleNavigate = useCallback((target) => {
    setNavigationTarget(target);
    setMobileTab('map');
  }, []);

  const sidebarContent = () => {
    if (selectedRestaurant) {
      return (
        <RestaurantDetail
          restaurant={selectedRestaurant}
          userLocation={userLocation}
          onBack={handleBack}
          onNavigate={handleNavigate}
        />
      );
    }
    return (
      <RestaurantList
        restaurants={restaurants}
        userLocation={userLocation}
        onSelect={handleSelectRestaurant}
        onSearchMap={() => {}}
        allergens={allergens}
      />
    );
  };

  const mapProps = {
    onRestaurantsFound: handleRestaurantsFound,
    onSelectRestaurant: handleSelectRestaurant,
    restaurants,
    userLocation,
    loading,
    setLoading,
    navigationTarget,
    onClearNavigation: () => setNavigationTarget(null),
    allergens,
    onAddAllergen: addAllergen,
    onRemoveAllergen: removeAllergen,
  };

  return (
    <div className={styles.app}>

      {/* ── Desktop ── */}
      <div className={styles.desktop}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h1 className={styles.logo}>Restaurant Finder</h1>
          </div>
          <nav className={styles.sidebarNav}>
            <button className={`${styles.navItem} ${styles.navActive}`}>
              <span className={styles.navIcon}></span>
              <span>Restaurants</span>
              {restaurants.length > 0 && <span className={styles.badge}>{restaurants.length}</span>}
            </button>
          </nav>
          <div className={styles.sidebarContent}>{sidebarContent()}</div>
        </aside>
        <main className={styles.mapArea}>
          <Map {...mapProps} desktopMode />
        </main>
      </div>

      {/* ── Mobile ── */}
      <div className={styles.mobile}>
        <header className={styles.mobileHeader}>
          <h1 className={styles.mobileTitle}>Restaurant Finder</h1>
        </header>
        <nav className={styles.mobileTabs} role="tablist">
          <button
            role="tab"
            aria-selected={mobileTab === 'map'}
            className={`${styles.mobileTab} ${mobileTab === 'map' ? styles.mobileTabActive : ''}`}
            onClick={() => setMobileTab('map')}
          >Map</button>
          <button
            role="tab"
            aria-selected={mobileTab === 'list'}
            className={`${styles.mobileTab} ${mobileTab === 'list' ? styles.mobileTabActive : ''}`}
            onClick={() => setMobileTab('list')}
          >{restaurants.length > 0 ? `Restaurants (${restaurants.length})` : 'Restaurants'}</button>
        </nav>
        <main className={styles.mobileMain}>
          <div style={{ display: mobileTab === 'map' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
            <Map {...mapProps} />
          </div>
          {mobileTab === 'list' && !selectedRestaurant && (
            <RestaurantList
              restaurants={restaurants}
              userLocation={userLocation}
              onSelect={handleSelectRestaurant}
              onSearchMap={() => setMobileTab('map')}
              allergens={allergens}
            />
          )}
          {mobileTab === 'list' && selectedRestaurant && (
            <RestaurantDetail
              restaurant={selectedRestaurant}
              userLocation={userLocation}
              onBack={handleBack}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

    </div>
  );
}
