# Fleet Management Tracker

A comprehensive real-time fleet management and parcel tracking application similar to Uber/Zomato tracking systems. This application provides GPS tracking, geofencing, and real-time monitoring capabilities.

## Features

### Core Functionality

- **Real-time GPS Tracking**: Track vehicles/parcels by UUID with minute-by-minute location updates
- **Interactive Map Interface**: Full-screen map with path visualization using OpenStreetMap
- **Geofencing**: Create 10km radius geofences with automatic alerts when vehicles leave the area
- **Path Visualization**: Real-time path tracking with distance and time calculations
- **UUID-based Tracking**: Search and track specific vehicles using unique identifiers

### User Interface

- **Split Layout**:
  - Left sidebar with tracking controls and geofencing options
  - Right side dominated by interactive map
- **Real-time Updates**: Live location updates via WebSocket connections
- **Alert System**: Toast notifications for geofence violations and system events
- **Statistics Dashboard**: Track active vehicles, distances, and alerts

### Technical Features

- **Database Storage**: SQLite database with location history, geofences, and alerts
- **REST API**: Complete API for location tracking and geofence management
- **WebSocket Integration**: Real-time bidirectional communication
- **Demo Mode**: Built-in demo with simulated GPS data for testing

## Technology Stack

### Backend

- **Node.js** with Express.js framework
- **Socket.io** for real-time WebSocket communication
- **SQLite3** for local database storage
- **Geolib** for geospatial calculations
- **Node-cron** for scheduled tasks

### Frontend

- **Vanilla JavaScript** (no framework dependencies)
- **Leaflet.js** for interactive mapping
- **Socket.io Client** for real-time updates
- **OpenStreetMap** tiles for map data
- **Font Awesome** for icons

## Installation

1. **Clone or navigate to the project directory**:

   ```bash
   cd c:\Users\AvinKapolkar\Desktop\fleet_management
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

   Or for production:

   ```bash
   npm start
   ```

4. **Open your browser**:
   ```
   http://localhost:3000
   ```

## Usage

### Starting a Demo

1. Click the "Start Demo" button in the left sidebar
2. A new UUID will be generated with simulated GPS tracking
3. The map will automatically center on the demo vehicle
4. Location updates will occur every minute

### Tracking a Specific UUID

1. Enter a UUID in the search box
2. Click "Track" to start monitoring
3. The map will show the vehicle's current location and path history
4. Location info will appear in the right panel

### Creating Geofences

1. Select a vehicle to track first
2. Enter the UUID in the geofence section
3. Set the radius (default 10,000m = 10km)
4. Click "Create Geofence" to use vehicle's current location
5. Or click on the map to set a custom geofence location
6. Alerts will trigger when the vehicle leaves the geofenced area

### Map Controls

- **Center Map**: Focus on the active tracker
- **Clear Paths**: Remove all path visualizations
- **Toggle Geofences**: Show/hide geofence circles

## API Endpoints

### Location Tracking

- `GET /api/trackers` - Get all tracked UUIDs
- `GET /api/locations/:uuid` - Get location history for UUID
- `GET /api/locations/:uuid/current` - Get current location
- `POST /api/locations` - Add new location data

### Geofencing

- `POST /api/geofences` - Create new geofence
- `GET /api/geofences/:uuid` - Get geofences for UUID
- `GET /api/alerts/:uuid` - Get geofence alerts

### Demo & Testing

- `POST /api/demo/start` - Start demo tracking

## Database Schema

### locations table

```sql
- id: INTEGER PRIMARY KEY
- uuid: TEXT (vehicle identifier)
- latitude: REAL (GPS latitude)
- longitude: REAL (GPS longitude)
- timestamp: DATETIME (when recorded)
- speed: REAL (km/h)
- heading: REAL (degrees)
```

### geofences table

```sql
- id: INTEGER PRIMARY KEY
- uuid: TEXT (vehicle identifier)
- center_lat: REAL (geofence center latitude)
- center_lng: REAL (geofence center longitude)
- radius: INTEGER (radius in meters)
- is_active: BOOLEAN (whether geofence is active)
- created_at: DATETIME (when created)
```

### geofence_alerts table

```sql
- id: INTEGER PRIMARY KEY
- uuid: TEXT (vehicle identifier)
- alert_type: TEXT (type of alert)
- latitude: REAL (where alert occurred)
- longitude: REAL (where alert occurred)
- timestamp: DATETIME (when alert occurred)
- message: TEXT (alert description)
```

## Real-world Integration

### GPS Device Integration

To integrate with real GPS devices, replace the demo tracking with actual GPS data:

```javascript
// Example: Send location update
fetch("/api/locations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    uuid: "your-vehicle-uuid",
    latitude: gpsLatitude,
    longitude: gpsLongitude,
    speed: currentSpeed,
    heading: currentHeading,
  }),
});
```

### Mobile App Integration

The REST API can be used by mobile applications to send location updates from vehicles or delivery personnel.

## Customization

### Map Providers

Change the map tiles in `app.js`:

```javascript
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(this.map);
```

### Geofence Radius

Modify default radius in the HTML or JavaScript:

```javascript
const radius =
  parseInt(document.getElementById("geofenceRadius").value) || 10000;
```

### Update Frequency

Change tracking frequency in `server.js`:

```javascript
}, 60000); // Every minute (60000ms)
```

## Security Considerations

- Add authentication for production use
- Implement rate limiting for API endpoints
- Validate all input data
- Use HTTPS in production
- Secure WebSocket connections

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

1. Check the console for error messages
2. Ensure all dependencies are installed
3. Verify the server is running on port 3000
4. Check that WebSocket connections are working
