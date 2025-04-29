document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const currentLocationInput = document.getElementById('current-location');
  const destinationsContainer = document.getElementById('destinations-container');
  const newDestinationInput = document.getElementById('new-destination');
  const addDestinationBtn = document.getElementById('add-destination-btn');
  const optimizeBtn = document.getElementById('optimize-btn');
  const resetBtn = document.getElementById('reset-btn');
  const errorMessage = document.getElementById('error-message');
  const statusMessage = document.getElementById('status-message');
  const mapPlaceholder = document.getElementById('map-placeholder');
  const optimizedRouteContainer = document.getElementById('optimized-route-container');
  const routeList = document.getElementById('route-list');
  const totalDistanceValue = document.getElementById('total-distance-value');

  // State
  let destinationCounter = 1;
  let optimizedRoute = [];
  let mapCenter = { lat: 0, lng: 0 };
  let mapZoom = 2;

  // Event Listeners
  addDestinationBtn.addEventListener('click', addDestination);
  newDestinationInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          addDestination();
      }
  });
  optimizeBtn.addEventListener('click', optimizeRoute);
  resetBtn.addEventListener('click', resetApp);
  
  // Initial setup - ensure we have at least one destination field
  if (destinationsContainer.children.length === 0) {
      addDestinationField();
  }

  // Event delegation for remove buttons
  destinationsContainer.addEventListener('click', (e) => {
      if (e.target.closest('.remove-btn')) {
          const destinationItem = e.target.closest('.destination-item');
          if (destinationsContainer.children.length > 1) {
              destinationItem.remove();
              updateDestinationNumbers();
          } else {
              // If it's the last one, just clear it
              const input = destinationItem.querySelector('input');
              input.value = '';
          }
      }
  });

  // Functions
  function addDestination() {
      const newDestValue = newDestinationInput.value.trim();
      
      if (newDestValue === '') {
          showError('Please enter a destination name');
          return;
      }
      
      addDestinationField(newDestValue);
      newDestinationInput.value = '';
      hideError();
  }

  function addDestinationField(value = '') {
      destinationCounter++;
      
      const destinationItem = document.createElement('div');
      destinationItem.className = 'destination-item';
      
      destinationItem.innerHTML = `
          <span class="destination-number">${destinationsContainer.children.length + 1}.</span>
          <input type="text" class="destination-input" value="${value}" placeholder="Enter destination">
          <button class="remove-btn" aria-label="Remove destination">
              <i class="fas fa-trash-alt"></i>
          </button>
      `;
      
      destinationsContainer.appendChild(destinationItem);
  }

  function updateDestinationNumbers() {
      const items = destinationsContainer.querySelectorAll('.destination-item');
      items.forEach((item, index) => {
          const numberSpan = item.querySelector('.destination-number');
          numberSpan.textContent = `${index + 1}.`;
      });
  }

  function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
  }

  function hideError() {
      errorMessage.style.display = 'none';
  }

  function showStatus(message) {
      statusMessage.textContent = message;
      statusMessage.style.display = 'block';
  }

  function hideStatus() {
      statusMessage.style.display = 'none';
  }

  async function optimizeRoute() {
      const currentLocation = currentLocationInput.value.trim();
      
      if (!currentLocation) {
          showError('Please enter your current location');
          return;
      }
      
      // Collect destinations
      const destinations = [];
      const destinationInputs = destinationsContainer.querySelectorAll('.destination-input');
      
      for (const input of destinationInputs) {
          const name = input.value.trim();
          if (name) {
              destinations.push({ name });
          }
      }
      
      if (destinations.length < 2) {
          showError('Please add at least two destinations');
          return;
      }
      
      hideError();
      showStatus('Optimizing route...');
      
      try {
          // Geocode the current location
          const startCoord = await geocodeLocation(currentLocation);
          
          // Geocode each destination
          for (const dest of destinations) {
              const coords = await geocodeLocation(dest.name);
              dest.lat = coords.lat;
              dest.lng = coords.lng;
          }
          
          // Start with the current location
          let route = [];
          let currentCoord = startCoord;
          let remainingDestinations = [...destinations];
          
          // Find nearest destination one by one
          while (remainingDestinations.length > 0) {
              // Calculate distances from current position to all remaining destinations
              const distancesToDestinations = remainingDestinations.map(dest => ({
                  ...dest,
                  distance: calculateDistance(currentCoord, { lat: dest.lat, lng: dest.lng })
              }));
              
              // Find the closest destination
              const closestDest = distancesToDestinations.reduce(
                  (min, dest) => dest.distance < min.distance ? dest : min,
                  { distance: Infinity }
              );
              
              // Add to route and update current position
              route.push(closestDest);
              currentCoord = { lat: closestDest.lat, lng: closestDest.lng };
              
              // Remove from remaining destinations
              remainingDestinations = remainingDestinations.filter(dest => dest.name !== closestDest.name);
          }
          
          optimizedRoute = [{ name: currentLocation, ...startCoord }, ...route];
          
          // Update map center to the middle point of all coordinates
          const allCoords = [startCoord, ...route.map(dest => ({ lat: dest.lat, lng: dest.lng }))];
          const centerLat = allCoords.reduce((sum, coord) => sum + coord.lat, 0) / allCoords.length;
          const centerLng = allCoords.reduce((sum, coord) => sum + coord.lng, 0) / allCoords.length;
          mapCenter = { lat: centerLat, lng: centerLng };
          mapZoom = 6;
          
          // Update the UI
          displayOptimizedRoute(optimizedRoute);
          updateMapPlaceholder(optimizedRoute);
          
          showStatus('Route optimized successfully!');
      } catch (error) {
          showError('Error while optimizing route: ' + error.message);
          hideStatus();
      }
  }

  function displayOptimizedRoute(route) {
      routeList.innerHTML = '';
      let totalDistance = 0;
      
      route.forEach((location, index) => {
          const listItem = document.createElement('li');
          listItem.className = 'route-item';
          
          const isStartLocation = index === 0;
          const nextLocation = index < route.length - 1 ? route[index + 1] : null;
          
          let distanceToNext = 0;
          if (nextLocation) {
              distanceToNext = calculateDistance(location, nextLocation);
              totalDistance += distanceToNext;
          }
          
          listItem.innerHTML = `
              <div class="route-item-header">
                  <div>
                      <span class="route-name">${location.name}</span>
                      ${isStartLocation ? '<span class="start-badge">Start</span>' : ''}
                  </div>
                  <div class="route-coords">(${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})</div>
              </div>
              ${nextLocation ? `
                  <div class="distance-indicator">
                      ↓ ${distanceToNext.toFixed(2)} km
                  </div>
              ` : ''}
          `;
          
          routeList.appendChild(listItem);
      });
      
      totalDistanceValue.textContent = `${totalDistance.toFixed(2)} km`;
      optimizedRouteContainer.style.display = 'block';
  }

  function updateMapPlaceholder(route) {
      if (route.length > 0) {
          mapPlaceholder.innerHTML = `
              <div style="text-align: center;">
                  <div style="font-weight: 500; margin-bottom: 8px;">Simulated Map View</div>
                  <div style="font-size: 0.875rem; color: #6b7280;">
                      Center: (${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})
                  </div>
                  <div style="font-size: 0.875rem; color: #6b7280;">
                      Route with ${route.length} points plotted
                  </div>
              </div>
          `;
      } else {
          mapPlaceholder.innerHTML = `
              <div class="map-placeholder-text">
                  Enter destinations and optimize route to see the map
              </div>
          `;
      }
  }

  function resetApp() {
      currentLocationInput.value = '';
      
      // Reset destinations to just one empty field
      destinationsContainer.innerHTML = '';
      addDestinationField();
      destinationCounter = 1;
      
      newDestinationInput.value = '';
      optimizedRoute = [];
      mapCenter = { lat: 0, lng: 0 };
      mapZoom = 2;
      
      hideError();
      hideStatus();
      optimizedRouteContainer.style.display = 'none';
      
      updateMapPlaceholder([]);
  }

  // Helper Functions
  async function geocodeLocation(locationName) {
      // Simulating geocoding since we don't have access to actual geocoding APIs
      // In a real application, you would use Google Maps Geocoding API or similar
      
      // For demo purposes, use known coordinates for popular cities
      const baseCoordinates = {
          "New York": { lat: 40.7128, lng: -74.0060 },
          "Los Angeles": { lat: 34.0522, lng: -118.2437 },
          "Chicago": { lat: 41.8781, lng: -87.6298 },
          "Houston": { lat: 29.7604, lng: -95.3698 },
          "Phoenix": { lat: 33.4484, lng: -112.0740 },
          "Philadelphia": { lat: 39.9526, lng: -75.1652 },
          "San Antonio": { lat: 29.4241, lng: -98.4936 },
          "San Diego": { lat: 32.7157, lng: -117.1611 },
          "Dallas": { lat: 32.7767, lng: -96.7970 },
          "San Jose": { lat: 37.3382, lng: -121.8863 },
      };

      // If we recognize the location, use the known coordinates
      if (baseCoordinates[locationName]) {
          return baseCoordinates[locationName];
      }

      // Otherwise generate random coordinates (simulating real geocoding)
      // In a real application, this would be replaced with an actual API call
      return new Promise((resolve) => {
          // Small delay to simulate API call
          setTimeout(() => {
              const randomOffset = () => (Math.random() - 0.5) * 10;
              resolve({
                  lat: 40 + randomOffset(),
                  lng: -95 + randomOffset(),
              });
          }, 100);
      });
  }

  function calculateDistance(coord1, coord2) {
      // Haversine formula to calculate distance between two coordinates
      const R = 6371; // Earth's radius in km
      const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
      const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
      
      const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c; // Distance in km
      
      return distance;
  }
});