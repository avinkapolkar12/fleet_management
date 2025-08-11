class FleetTracker {
    constructor() {
        this.map = null;
        this.socket = null;
        this.trackers = new Map();
        this.geofences = new Map();
        this.activeTracker = null;
        this.pathLayers = new Map();
        this.markerLayers = new Map();
        this.geofenceCircles = new Map();
        this.showGeofences = true;
        
        this.init();
    }

    init() {
        this.initMap();
        this.initSocket();
        this.bindEvents();
        this.loadTrackers();
        this.updateStats();
    }

    initMap() {
        // Initialize map centered on Delhi, India
        this.map = L.map('map').setView([28.6139, 77.2090], 12);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add map click handler for creating geofences
        this.map.on('click', (e) => {
            if (this.activeTracker) {
                this.showGeofenceDialog(e.latlng);
            }
        });
    }

    initSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.showToast('Connected to tracking server', 'success');
        });

        this.socket.on('locationUpdate', (location) => {
            this.handleLocationUpdate(location);
        });

        this.socket.on('geofenceAlert', (alert) => {
            this.handleGeofenceAlert(alert);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showToast('Disconnected from server', 'error');
        });
    }

    bindEvents() {
        // Track button
        document.getElementById('trackBtn').addEventListener('click', () => {
            const uuid = document.getElementById('uuidInput').value.trim();
            if (uuid) {
                this.trackUuid(uuid);
            }
        });

        // Demo button
        document.getElementById('demoBtn').addEventListener('click', () => {
            this.startDemo();
        });

        // Add test data button (will be created)
        this.addTestDataButton();
        
        // Add geofence test button
        this.addGeofenceTestButton();

        // Create geofence button
        document.getElementById('createGeofenceBtn').addEventListener('click', () => {
            this.createGeofence();
        });

        // Map controls
        document.getElementById('centerMapBtn').addEventListener('click', () => {
            this.centerMap();
        });

        document.getElementById('clearPathBtn').addEventListener('click', () => {
            this.clearPaths();
        });

        document.getElementById('toggleGeofencesBtn').addEventListener('click', () => {
            this.toggleGeofences();
        });

        // Enter key handlers
        document.getElementById('uuidInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('trackBtn').click();
            }
        });
    }

    addGeofenceTestButton() {
        // Create geofence test button if it doesn't exist
        const existingBtn = document.getElementById('geofenceTestBtn');
        if (existingBtn) return;

        const testDataBtn = document.getElementById('testDataBtn');
        const geofenceTestBtn = document.createElement('button');
        geofenceTestBtn.id = 'geofenceTestBtn';
        geofenceTestBtn.className = 'btn btn-info';
        geofenceTestBtn.style.marginTop = '10px';
        geofenceTestBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Test Geofencing';
        
        geofenceTestBtn.addEventListener('click', () => {
            this.testGeofencing();
        });
        
        testDataBtn.parentNode.appendChild(geofenceTestBtn);
    }

    async testGeofencing() {
        const testUuid = 'GEOFENCE-TEST-001';
        
        try {
            this.showToast('Setting up geofence test...', 'info');
            
            // Create initial location
            const initialLocation = {
                uuid: testUuid,
                latitude: 28.6139,
                longitude: 77.2090,
                speed: 0,
                heading: 0
            };

            // Add initial location
            await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialLocation)
            });

            // Create a small geofence around initial location
            const geofenceData = {
                uuid: testUuid,
                center_lat: 28.6139,
                center_lng: 77.2090,
                radius: 500 // 500m radius for testing
            };

            await fetch('/api/geofences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geofenceData)
            });

            // Track the test UUID
            this.trackUuid(testUuid);
            
            // Simulate movement that will trigger geofence alerts
            setTimeout(() => this.simulateGeofenceMovement(testUuid), 2000);
            
            this.showToast(`Geofence test started! UUID: ${testUuid}`, 'success');
            
        } catch (error) {
            console.error('Error setting up geofence test:', error);
            this.showToast('Error setting up geofence test', 'error');
        }
    }

    async simulateGeofenceMovement(uuid) {
        const movements = [
            // Stay inside geofence
            { lat: 28.6139, lng: 77.2090, message: "Starting inside geofence" },
            { lat: 28.6141, lng: 77.2092, message: "Moving slightly (still inside)" },
            
            // Move outside geofence
            { lat: 28.6180, lng: 77.2140, message: "Moving outside geofence (should trigger EXIT alert)" },
            { lat: 28.6200, lng: 77.2160, message: "Further outside" },
            
            // Move back inside
            { lat: 28.6145, lng: 77.2095, message: "Moving back inside (should trigger ENTER alert)" },
            { lat: 28.6139, lng: 77.2090, message: "Back to center" }
        ];

        for (let i = 0; i < movements.length; i++) {
            const movement = movements[i];
            
            setTimeout(async () => {
                const locationData = {
                    uuid: uuid,
                    latitude: movement.lat,
                    longitude: movement.lng,
                    speed: 25,
                    heading: 45
                };

                try {
                    await fetch('/api/locations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(locationData)
                    });
                    
                    console.log(`Geofence test step ${i + 1}: ${movement.message}`);
                    this.showToast(`Step ${i + 1}: ${movement.message}`, 'info');
                    
                } catch (error) {
                    console.error('Error in geofence movement simulation:', error);
                }
            }, i * 5000); // 5 second intervals
        }
    }

    addTestDataButton() {
        // Create test data button if it doesn't exist
        const existingBtn = document.getElementById('testDataBtn');
        if (existingBtn) return;

        const demoBtn = document.getElementById('demoBtn');
        const testBtn = document.createElement('button');
        testBtn.id = 'testDataBtn';
        testBtn.className = 'btn btn-warning';
        testBtn.style.marginTop = '10px';
        testBtn.innerHTML = '<i class="fas fa-database"></i> Create Test Data';
        
        testBtn.addEventListener('click', () => {
            this.createTestData();
        });
        
        demoBtn.parentNode.appendChild(testBtn);
    }

    addGeofenceTestButton() {
        // Create geofence test button if it doesn't exist
        const existingBtn = document.getElementById('geofenceTestBtn');
        if (existingBtn) return;

        const testDataBtn = document.getElementById('testDataBtn');
        const geofenceTestBtn = document.createElement('button');
        geofenceTestBtn.id = 'geofenceTestBtn';
        geofenceTestBtn.className = 'btn btn-info';
        geofenceTestBtn.style.marginTop = '10px';
        geofenceTestBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Test Geofencing';
        
        geofenceTestBtn.addEventListener('click', () => {
            this.testGeofencing();
        });
        
        testDataBtn.parentNode.appendChild(geofenceTestBtn);
    }

    async testGeofencing() {
        const testUuid = 'GEOFENCE-TEST-001';
        
        try {
            this.showToast('Setting up geofence test...', 'info');
            
            // Create initial location
            const initialLocation = {
                uuid: testUuid,
                latitude: 28.6139,
                longitude: 77.2090,
                speed: 0,
                heading: 0
            };

            // Add initial location
            await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(initialLocation)
            });

            // Create a small geofence around initial location
            const geofenceData = {
                uuid: testUuid,
                center_lat: 28.6139,
                center_lng: 77.2090,
                radius: 500 // 500m radius for testing
            };

            await fetch('/api/geofences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geofenceData)
            });

            // Track the test UUID
            this.trackUuid(testUuid);
            
            // Simulate movement that will trigger geofence alerts
            setTimeout(() => this.simulateGeofenceMovement(testUuid), 2000);
            
            this.showToast(`Geofence test started! UUID: ${testUuid}`, 'success');
            
        } catch (error) {
            console.error('Error setting up geofence test:', error);
            this.showToast('Error setting up geofence test', 'error');
        }
    }

    async simulateGeofenceMovement(uuid) {
        const movements = [
            // Stay inside geofence
            { lat: 28.6139, lng: 77.2090, message: "Starting inside geofence" },
            { lat: 28.6141, lng: 77.2092, message: "Moving slightly (still inside)" },
            
            // Move outside geofence
            { lat: 28.6180, lng: 77.2140, message: "Moving outside geofence (should trigger EXIT alert)" },
            { lat: 28.6200, lng: 77.2160, message: "Further outside" },
            
            // Move back inside
            { lat: 28.6145, lng: 77.2095, message: "Moving back inside (should trigger ENTER alert)" },
            { lat: 28.6139, lng: 77.2090, message: "Back to center" }
        ];

        for (let i = 0; i < movements.length; i++) {
            const movement = movements[i];
            
            setTimeout(async () => {
                const locationData = {
                    uuid: uuid,
                    latitude: movement.lat,
                    longitude: movement.lng,
                    speed: 25,
                    heading: 45
                };

                try {
                    await fetch('/api/locations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(locationData)
                    });
                    
                    console.log(`Geofence test step ${i + 1}: ${movement.message}`);
                    this.showToast(`Step ${i + 1}: ${movement.message}`, 'info');
                    
                } catch (error) {
                    console.error('Error in geofence movement simulation:', error);
                }
            }, i * 5000); // 5 second intervals
        }
    }

    async createTestData() {
        // Just one test vehicle for simplicity
        const testUuid = 'TRUCK-001-DEMO';
        
        // Simple route: 5 points around Delhi
        const simpleRoute = [
            { lat: 28.6139, lng: 77.2090, city: "Delhi - Start", speed: 0 },
            { lat: 28.6200, lng: 77.2150, city: "Delhi - Moving", speed: 35 },
            { lat: 28.6280, lng: 77.2220, city: "Delhi - Highway", speed: 60 },
            { lat: 28.6350, lng: 77.2300, city: "Delhi - Destination", speed: 25 },
            { lat: 28.6400, lng: 77.2350, city: "Delhi - Parked", speed: 0 }
        ];

        try {
            this.showToast('Creating simple test data...', 'info');
            
            // Create location points for the test vehicle
            for (let i = 0; i < simpleRoute.length; i++) {
                const point = simpleRoute[i];
                
                // Calculate heading to next point
                let heading = 45; // Default northeast
                if (i < simpleRoute.length - 1) {
                    const nextPoint = simpleRoute[i + 1];
                    heading = this.calculateBearing(
                        point.lat, point.lng,
                        nextPoint.lat, nextPoint.lng
                    );
                }

                const locationData = {
                    uuid: testUuid,
                    latitude: point.lat,
                    longitude: point.lng,
                    speed: point.speed,
                    heading: heading
                };

                const response = await fetch('/api/locations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(locationData)
                });

                if (!response.ok) {
                    throw new Error(`Failed to create test data for ${testUuid}`);
                }
                
                console.log(`Added point: ${point.city}`);
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            this.showToast(`Simple test data created! Track UUID: ${testUuid}`, 'success');
            
            // Refresh tracker list
            this.loadTrackers();
            
        } catch (error) {
            console.error('Error creating test data:', error);
            this.showToast('Error creating test data', 'error');
        }
    }

    // Helper function to generate detailed route with intermediate points
    generateDetailedRoute(majorPoints) {
        const detailedRoute = [];
        
        for (let i = 0; i < majorPoints.length - 1; i++) {
            const start = majorPoints[i];
            const end = majorPoints[i + 1];
            
            // Add the current major point
            detailedRoute.push(start);
            
            // Calculate intermediate points between major waypoints
            const distance = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
            const numIntermediatePoints = Math.max(2, Math.floor(distance / 20)); // One point every ~20km
            
            for (let j = 1; j < numIntermediatePoints; j++) {
                const ratio = j / numIntermediatePoints;
                const intermediateLat = start.lat + (end.lat - start.lat) * ratio;
                const intermediateLng = start.lng + (end.lng - start.lng) * ratio;
                
                // Add small road curvature simulation
                const curvature = (Math.sin(ratio * Math.PI * 3) * 0.001) + (Math.random() - 0.5) * 0.0005;
                
                detailedRoute.push({
                    lat: intermediateLat + curvature,
                    lng: intermediateLng + curvature,
                    city: `Highway waypoint ${i}-${j}`,
                    time: this.interpolateTime(start.time, end.time, ratio),
                    isIntermediate: true
                });
            }
        }
        
        // Add the final point
        detailedRoute.push(majorPoints[majorPoints.length - 1]);
        
        return detailedRoute;
    }

    // Helper function to calculate realistic speed based on road conditions
    calculateRealisticSpeed(point, index, route) {
        let baseSpeed = 60; // Default highway speed
        
        // City areas - slower speeds
        if (point.city && (
            point.city.includes('Delhi') || 
            point.city.includes('Mumbai') || 
            point.city.includes('Bhopal') ||
            point.city.includes('Indore') ||
            point.city.includes('Surat') ||
            point.city.includes('Vadodara')
        )) {
            baseSpeed = Math.random() * 20 + 25; // 25-45 km/h in cities
        }
        // Highway sections
        else if (point.city && point.city.includes('Highway')) {
            baseSpeed = Math.random() * 30 + 70; // 70-100 km/h on highways
        }
        // Bypass and ring roads
        else if (point.city && (point.city.includes('Bypass') || point.city.includes('Ring'))) {
            baseSpeed = Math.random() * 25 + 50; // 50-75 km/h on bypasses
        }
        // Entry/exit points
        else if (point.city && (point.city.includes('Entry') || point.city.includes('Exit'))) {
            baseSpeed = Math.random() * 20 + 40; // 40-60 km/h at entries/exits
        }
        // Regular highway stretches
        else {
            baseSpeed = Math.random() * 25 + 65; // 65-90 km/h normal highway
        }
        
        // Add traffic simulation (random speed reduction)
        if (Math.random() < 0.1) { // 10% chance of traffic
            baseSpeed *= 0.5; // Reduce speed by half during traffic
        }
        
        return Math.round(Math.max(15, Math.min(baseSpeed, 110))); // Keep realistic limits
    }

    // Helper function to interpolate time between two time points
    interpolateTime(startTime, endTime, ratio) {
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const interpolatedMinutes = startMinutes + (endMinutes - startMinutes) * ratio;
        return this.minutesToTime(interpolatedMinutes);
    }

    // Convert time string to minutes
    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Convert minutes back to time string
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    // Helper function to calculate distance between two points (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Helper function to calculate bearing between two points
    calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360; // Normalize to 0-360
    }

    async loadTrackers() {
        try {
            const response = await fetch('/api/trackers');
            const trackers = await response.json();
            
            trackers.forEach(uuid => {
                this.addTrackerToList(uuid);
            });
            
            this.updateStats();
        } catch (error) {
            console.error('Error loading trackers:', error);
        }
    }

    async trackUuid(uuid) {
        try {
            // First check if UUID exists
            const response = await fetch(`/api/locations/${uuid}/current`);
            
            if (!response.ok) {
                this.showToast(`UUID ${uuid} not found`, 'error');
                return;
            }

            const currentLocation = await response.json();
            
            // Join tracking room
            this.socket.emit('trackUuid', uuid);
            
            // Set as active tracker
            this.setActiveTracker(uuid);
            
            // Load location history
            await this.loadLocationHistory(uuid);
            
            // Load geofences
            await this.loadGeofences(uuid);
            
            // Center map on current location
            this.map.setView([currentLocation.latitude, currentLocation.longitude], 15);
            
            this.showToast(`Now tracking ${uuid}`, 'success');
            
        } catch (error) {
            console.error('Error tracking UUID:', error);
            this.showToast('Error tracking UUID', 'error');
        }
    }

    async loadLocationHistory(uuid) {
        try {
            const response = await fetch(`/api/locations/${uuid}?limit=100`);
            const locations = await response.json();
            
            if (locations.length > 0) {
                this.updatePath(uuid, locations);
                this.updateMarker(uuid, locations[locations.length - 1]);
            }
            
        } catch (error) {
            console.error('Error loading location history:', error);
        }
    }

    async loadGeofences(uuid) {
        try {
            const response = await fetch(`/api/geofences/${uuid}`);
            const geofences = await response.json();
            
            geofences.forEach(geofence => {
                this.addGeofenceToMap(geofence);
            });
            
        } catch (error) {
            console.error('Error loading geofences:', error);
        }
    }

    setActiveTracker(uuid) {
        // Remove active class from all trackers
        document.querySelectorAll('.tracker-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to selected tracker
        const trackerElement = document.querySelector(`[data-uuid="${uuid}"]`);
        if (trackerElement) {
            trackerElement.classList.add('active');
        }
        
        this.activeTracker = uuid;
        
        // Update tracker info panel
        this.updateTrackerInfo(uuid);
        
        // Clear geofence input
        document.getElementById('geofenceUuid').value = uuid;
    }

    updateTrackerInfo(uuid) {
        const infoPanel = document.getElementById('selectedTracker');
        const uuidElement = document.getElementById('trackerUuid');
        
        uuidElement.textContent = uuid;
        infoPanel.style.display = 'block';
        
        // Update with latest location data if available
        if (this.trackers.has(uuid)) {
            const tracker = this.trackers.get(uuid);
            this.updateTrackerInfoData(tracker);
        }
    }

    updateTrackerInfoData(location) {
        document.getElementById('lastUpdate').textContent = 
            new Date(location.timestamp).toLocaleString();
        document.getElementById('currentSpeed').textContent = 
            Math.round(location.speed || 0);
        
        // Calculate total distance (simplified)
        const tracker = this.trackers.get(location.uuid);
        if (tracker && tracker.locations) {
            const distance = this.calculateTotalDistance(tracker.locations);
            document.getElementById('totalDistanceTraveled').textContent = 
                distance.toFixed(2);
        }
    }

    calculateTotalDistance(locations) {
        let totalDistance = 0;
        
        for (let i = 1; i < locations.length; i++) {
            const prev = locations[i - 1];
            const curr = locations[i];
            
            // Haversine formula for distance calculation
            const R = 6371; // Earth's radius in km
            const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
            const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
            
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            totalDistance += R * c;
        }
        
        return totalDistance;
    }

    handleLocationUpdate(location) {
        // Update tracker data
        if (!this.trackers.has(location.uuid)) {
            this.trackers.set(location.uuid, {
                uuid: location.uuid,
                locations: [],
                lastUpdate: location.timestamp
            });
            this.addTrackerToList(location.uuid);
        }
        
        const tracker = this.trackers.get(location.uuid);
        tracker.locations.push(location);
        tracker.lastUpdate = location.timestamp;
        
        // Keep only last 100 locations to avoid memory issues
        if (tracker.locations.length > 100) {
            tracker.locations.shift();
        }
        
        // Update map
        this.updatePath(location.uuid, tracker.locations);
        this.updateMarker(location.uuid, location);
        
        // Update info panel if this is the active tracker
        if (this.activeTracker === location.uuid) {
            this.updateTrackerInfoData(location);
        }
        
        this.updateStats();
    }

    updatePath(uuid, locations) {
        // Remove existing path
        if (this.pathLayers.has(uuid)) {
            this.map.removeLayer(this.pathLayers.get(uuid));
        }
        
        if (locations.length > 1) {
            const coords = locations.map(loc => [loc.latitude, loc.longitude]);
            const path = L.polyline(coords, {
                color: this.getTrackerColor(uuid),
                weight: 3,
                opacity: 0.7
            }).addTo(this.map);
            
            this.pathLayers.set(uuid, path);
        }
    }

    updateMarker(uuid, location) {
        // Remove existing marker
        if (this.markerLayers.has(uuid)) {
            this.map.removeLayer(this.markerLayers.get(uuid));
        }
        
        // Create custom marker icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${this.getTrackerColor(uuid)}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        
        const marker = L.marker([location.latitude, location.longitude], { icon })
            .addTo(this.map);
        
        // Add popup with location info
        const popupContent = `
            <div class="popup-content">
                <h4>UUID: ${uuid}</h4>
                <p><i class="fas fa-clock"></i> ${new Date(location.timestamp).toLocaleString()}</p>
                <p><i class="fas fa-tachometer-alt"></i> Speed: ${Math.round(location.speed || 0)} km/h</p>
                <p><i class="fas fa-compass"></i> Heading: ${Math.round(location.heading || 0)}°</p>
                <p><i class="fas fa-map-marker-alt"></i> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        this.markerLayers.set(uuid, marker);
    }

    getTrackerColor(uuid) {
        // Generate consistent color for each UUID
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
        const hash = this.hashCode(uuid);
        return colors[Math.abs(hash) % colors.length];
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    addTrackerToList(uuid) {
        const trackersList = document.getElementById('trackersList');
        
        // Check if already exists
        if (document.querySelector(`[data-uuid="${uuid}"]`)) {
            return;
        }
        
        const trackerElement = document.createElement('div');
        trackerElement.className = 'tracker-item';
        trackerElement.setAttribute('data-uuid', uuid);
        trackerElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${uuid.substring(0, 8)}...</span>
                <span style="width: 10px; height: 10px; background-color: ${this.getTrackerColor(uuid)}; border-radius: 50%; display: inline-block;"></span>
            </div>
        `;
        
        trackerElement.addEventListener('click', () => {
            this.trackUuid(uuid);
        });
        
        trackersList.appendChild(trackerElement);
    }

    async startDemo() {
        try {
            const response = await fetch('/api/demo/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showToast(`Demo started with UUID: ${result.uuid.substring(0, 8)}...`, 'success');
                
                // Auto-track the demo UUID
                setTimeout(() => {
                    document.getElementById('uuidInput').value = result.uuid;
                    this.trackUuid(result.uuid);
                }, 2000);
            } else {
                this.showToast('Error starting demo', 'error');
            }
            
        } catch (error) {
            console.error('Error starting demo:', error);
            this.showToast('Error starting demo', 'error');
        }
    }

    async createGeofence() {
        const uuid = document.getElementById('geofenceUuid').value.trim();
        const radius = parseInt(document.getElementById('geofenceRadius').value) || 1000; // Default 1km
        
        if (!uuid) {
            this.showToast('Please enter a UUID for the geofence', 'warning');
            return;
        }
        
        if (!this.activeTracker) {
            this.showToast('Please track a UUID first to get current location', 'warning');
            return;
        }
        
        // Get current location of the tracker
        try {
            const response = await fetch(`/api/locations/${uuid}/current`);
            
            if (!response.ok) {
                this.showToast(`UUID ${uuid} not found or has no location data`, 'error');
                return;
            }
            
            const location = await response.json();
            
            const geofenceData = {
                uuid: uuid,
                center_lat: location.latitude,
                center_lng: location.longitude,
                radius: radius
            };
            
            console.log('Creating geofence with data:', geofenceData);
            
            const createResponse = await fetch('/api/geofences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(geofenceData)
            });
            
            if (createResponse.ok) {
                const geofence = await createResponse.json();
                this.addGeofenceToMap(geofence);
                this.showToast(`Geofence created with ${radius}m radius at current location`, 'success');
                console.log('Geofence created successfully:', geofence);
            } else {
                const errorData = await createResponse.json();
                console.error('Error creating geofence:', errorData);
                this.showToast(`Error creating geofence: ${errorData.error}`, 'error');
            }
            
        } catch (error) {
            console.error('Error creating geofence:', error);
            this.showToast('Error creating geofence', 'error');
        }
    }

    showGeofenceDialog(latlng) {
        const uuid = this.activeTracker;
        if (!uuid) {
            this.showToast('Please select a tracker first', 'warning');
            return;
        }
        
        const radius = parseInt(document.getElementById('geofenceRadius').value) || 1000; // Default 1km
        
        if (confirm(`Create a geofence here for ${uuid} with radius ${radius}m?`)) {
            const geofenceData = {
                uuid: uuid,
                center_lat: latlng.lat,
                center_lng: latlng.lng,
                radius: radius
            };
            
            console.log('Creating geofence via map click:', geofenceData);
            
            fetch('/api/geofences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(geofenceData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(geofence => {
                this.addGeofenceToMap(geofence);
                this.showToast('Geofence created', 'success');
                console.log('Geofence created successfully:', geofence);
            })
            .catch(error => {
                console.error('Error creating geofence:', error);
                this.showToast('Error creating geofence', 'error');
            });
        }
    }

    addGeofenceToMap(geofence) {
        const circle = L.circle([geofence.center_lat, geofence.center_lng], {
            color: '#ff7800',
            fillColor: '#ff7800',
            fillOpacity: 0.1,
            radius: geofence.radius
        }).addTo(this.map);
        
        circle.bindPopup(`
            <div class="popup-content">
                <h4>Geofence</h4>
                <p><i class="fas fa-user"></i> UUID: ${geofence.uuid}</p>
                <p><i class="fas fa-ruler-combined"></i> Radius: ${geofence.radius}m</p>
                <p><i class="fas fa-map-marker-alt"></i> Center: ${geofence.center_lat.toFixed(6)}, ${geofence.center_lng.toFixed(6)}</p>
            </div>
        `);
        
        this.geofenceCircles.set(geofence.id, circle);
        
        // Add to geofences list
        this.addGeofenceToList(geofence);
    }

    addGeofenceToList(geofence) {
        const geofencesList = document.getElementById('geofencesList');
        
        const geofenceElement = document.createElement('div');
        geofenceElement.className = 'geofence-item';
        geofenceElement.innerHTML = `
            <div>
                <strong>${geofence.uuid.substring(0, 8)}...</strong>
                <br>
                <small>Radius: ${geofence.radius}m</small>
            </div>
        `;
        
        geofencesList.appendChild(geofenceElement);
    }

    handleGeofenceAlert(alert) {
        console.log('🚨 Geofence alert received:', alert);
        
        // Show toast with appropriate icon and color
        const alertType = alert.alert_type === 'GEOFENCE_ENTER' ? 'success' : 'warning';
        const icon = alert.alert_type === 'GEOFENCE_ENTER' ? '✅' : '⚠️';
        
        this.showToast(`${icon} ${alert.message}`, alertType);
        this.addAlertToList(alert);
        
        // Flash the map marker and center on it
        if (this.markerLayers.has(alert.uuid)) {
            const marker = this.markerLayers.get(alert.uuid);
            marker.openPopup();
            
            // Flash effect
            const originalIcon = marker.options.icon;
            const flashIcon = L.divIcon({
                className: 'custom-marker flash',
                html: `<div style="background-color: ${alert.alert_type === 'GEOFENCE_ENTER' ? '#28a745' : '#ffc107'}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(255,0,0,0.8); animation: pulse 1s infinite;"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            marker.setIcon(flashIcon);
            
            // Center map on alert location
            this.map.setView([alert.latitude, alert.longitude], 16);
            
            // Restore original icon after 3 seconds
            setTimeout(() => {
                marker.setIcon(originalIcon);
            }, 3000);
        }
    }

    addAlertToList(alert) {
        const alertsList = document.getElementById('alertsList');
        
        const alertElement = document.createElement('div');
        alertElement.className = 'alert-item';
        alertElement.innerHTML = `
            <div>
                <strong>${alert.uuid.substring(0, 8)}...</strong>
                <br>
                <small>${alert.message}</small>
                <br>
                <small>${new Date(alert.timestamp).toLocaleString()}</small>
            </div>
        `;
        
        alertsList.insertBefore(alertElement, alertsList.firstChild);
        
        // Keep only last 10 alerts
        while (alertsList.children.length > 11) { // +1 for the h4 header
            alertsList.removeChild(alertsList.lastChild);
        }
    }

    centerMap() {
        if (this.activeTracker && this.markerLayers.has(this.activeTracker)) {
            const marker = this.markerLayers.get(this.activeTracker);
            this.map.setView(marker.getLatLng(), 15);
        } else {
            // Center on Delhi
            this.map.setView([28.6139, 77.2090], 12);
        }
    }

    clearPaths() {
        this.pathLayers.forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.pathLayers.clear();
        
        this.showToast('All paths cleared', 'info');
    }

    toggleGeofences() {
        this.showGeofences = !this.showGeofences;
        
        this.geofenceCircles.forEach(circle => {
            if (this.showGeofences) {
                circle.addTo(this.map);
            } else {
                this.map.removeLayer(circle);
            }
        });
        
        const button = document.getElementById('toggleGeofencesBtn');
        button.innerHTML = this.showGeofences 
            ? '<i class="fas fa-eye"></i> Hide Geofences'
            : '<i class="fas fa-eye-slash"></i> Show Geofences';
    }

    updateStats() {
        document.getElementById('totalTrackers').textContent = this.trackers.size;
        
        // Calculate total distance
        let totalDistance = 0;
        this.trackers.forEach(tracker => {
            if (tracker.locations) {
                totalDistance += this.calculateTotalDistance(tracker.locations);
            }
        });
        
        document.getElementById('totalDistance').textContent = `${totalDistance.toFixed(1)} km`;
        
        // Count alerts (simplified - would need API call for accurate count)
        const alertsCount = document.getElementById('alertsList').children.length - 1; // -1 for header
        document.getElementById('totalAlerts').textContent = Math.max(0, alertsCount);
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const typeIcons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toast.innerHTML = `
            <h5><i class="${typeIcons[type]}"></i> ${type.charAt(0).toUpperCase() + type.slice(1)}</h5>
            <p>${message}</p>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FleetTracker();
});
