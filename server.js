const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const geolib = require('geolib');
const path = require('path');
const net = require('net');

// MongoDB imports
const { connectDB, closeDB } = require('./config/database');
const Location = require('./models/Location');
const Geofence = require('./models/Geofence');
const Alert = require('./models/Alert');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Function to find available port
function findAvailablePort(startPort = 3000, maxPort = 65535) {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            if (port > maxPort) {
                reject(new Error('No available ports found'));
                return;
            }
            
            const testServer = net.createServer();
            testServer.listen(port, () => {
                testServer.close(() => {
                    resolve(port);
                });
            });
            
            testServer.on('error', () => {
                tryPort(port + 1);
            });
        };
        
        tryPort(startPort);
    });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize MongoDB connection
async function initializeDatabase() {
    try {
        await connectDB();
        console.log('✅ MongoDB database connected and ready');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }
}

// Store for active tracking sessions
const activeTrackers = new Map();
const geofences = new Map();

// API Routes

// Get all tracked UUIDs
app.get('/api/trackers', async (req, res) => {
    try {
        const trackers = await Location.distinct('uuid');
        res.json(trackers);
    } catch (error) {
        console.error('Error getting trackers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get location history for a UUID
app.get('/api/locations/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { limit = 100 } = req.query;
        
        const locations = await Location.find({ uuid })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
            
        // Return in chronological order
        res.json(locations.reverse());
    } catch (error) {
        console.error('Error getting location history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current location for a UUID
app.get('/api/locations/:uuid/current', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const location = await Location.findOne({ uuid })
            .sort({ timestamp: -1 })
            .lean();
            
        if (!location) {
            return res.status(404).json({ error: 'UUID not found' });
        }
        
        res.json(location);
    } catch (error) {
        console.error('Error getting current location:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add a new location
app.post('/api/locations', async (req, res) => {
    try {
        const { uuid, latitude, longitude, speed = 0, heading = 0 } = req.body;
        
        if (!uuid || !latitude || !longitude) {
            return res.status(400).json({ error: 'UUID, latitude, and longitude are required' });
        }

        const location = new Location({
            uuid,
            latitude,
            longitude,
            speed,
            heading
        });
        
        await location.save();
        
        // Broadcast to connected clients
        io.emit('locationUpdate', location);
        
        // Check geofences
        await checkGeofences(uuid, latitude, longitude);
        
        res.json(location);
    } catch (error) {
        console.error('Error adding location:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create geofence
app.post('/api/geofences', async (req, res) => {
    try {
        const { uuid, center_lat, center_lng, radius = 1000 } = req.body; // Default 1km instead of 10km
        
        if (!uuid || !center_lat || !center_lng) {
            return res.status(400).json({ error: 'UUID, center coordinates are required' });
        }

        const geofence = new Geofence({
            uuid,
            center_lat,
            center_lng,
            radius
        });
        
        await geofence.save();
        
        console.log(`✅ Geofence created for ${uuid} at (${center_lat}, ${center_lng}) with ${radius}m radius`);
        
        res.json(geofence);
    } catch (error) {
        console.error('Error creating geofence:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get geofences for a UUID
app.get('/api/geofences/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const geofenceList = await Geofence.find({ uuid, is_active: true }).lean();
        res.json(geofenceList);
    } catch (error) {
        console.error('Error getting geofences:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete a specific geofence
app.delete('/api/geofences/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const geofence = await Geofence.findByIdAndUpdate(
            id, 
            { is_active: false }, 
            { new: true }
        );
        
        if (!geofence) {
            return res.status(404).json({ error: 'Geofence not found' });
        }
        
        console.log(`🗑️ Geofence deactivated: ${id}`);
        res.json({ message: 'Geofence deactivated', geofence });
    } catch (error) {
        console.error('Error deleting geofence:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get geofence alerts
app.get('/api/alerts/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { limit = 50 } = req.query;
        
        const alerts = await Alert.find({ uuid })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();
            
        res.json(alerts);
    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate demo UUID with random tracking
app.post('/api/demo/start', (req, res) => {
    const demoUuid = uuidv4();
    
    // Start demo tracking (simulated GPS data)
    startDemoTracking(demoUuid);
    
    res.json({ uuid: demoUuid, message: 'Demo tracking started' });
});

// Function to check geofences
async function checkGeofences(uuid, latitude, longitude) {
    try {
        const geofenceList = await Geofence.find({ uuid, is_active: true });
        
        for (const geofence of geofenceList) {
            const distance = geolib.getDistance(
                { latitude, longitude },
                { latitude: geofence.center_lat, longitude: geofence.center_lng }
            );
            
            const isInside = distance <= geofence.radius;
            const previousState = geofence.lastKnownState; // We'll track this
            
            // Check if state changed
            if (previousState === undefined) {
                // First time checking this geofence
                geofence.lastKnownState = isInside;
                await Geofence.findByIdAndUpdate(geofence._id, { lastKnownState: isInside });
                
                if (!isInside) {
                    // Vehicle starts outside geofence
                    const alert = new Alert({
                        uuid,
                        alert_type: 'GEOFENCE_EXIT',
                        latitude,
                        longitude,
                        message: `Vehicle ${uuid} is outside geofence (${Math.round(distance)}m from center)`,
                        geofence_id: geofence._id,
                        severity: 'HIGH'
                    });
                    
                    await alert.save();
                    io.emit('geofenceAlert', alert);
                    console.log(`🚨 Geofence alert: ${uuid} outside geofence (${Math.round(distance)}m)`);
                }
            } else if (previousState !== isInside) {
                // State changed
                geofence.lastKnownState = isInside;
                await Geofence.findByIdAndUpdate(geofence._id, { lastKnownState: isInside });
                
                if (isInside) {
                    // Entered geofence
                    const alert = new Alert({
                        uuid,
                        alert_type: 'GEOFENCE_ENTER',
                        latitude,
                        longitude,
                        message: `Vehicle ${uuid} entered geofence (${Math.round(distance)}m from center)`,
                        geofence_id: geofence._id,
                        severity: 'MEDIUM'
                    });
                    
                    await alert.save();
                    io.emit('geofenceAlert', alert);
                    console.log(`✅ Geofence alert: ${uuid} entered geofence (${Math.round(distance)}m)`);
                } else {
                    // Exited geofence
                    const alert = new Alert({
                        uuid,
                        alert_type: 'GEOFENCE_EXIT',
                        latitude,
                        longitude,
                        message: `Vehicle ${uuid} left geofence (${Math.round(distance)}m from center)`,
                        geofence_id: geofence._id,
                        severity: 'HIGH'
                    });
                    
                    await alert.save();
                    io.emit('geofenceAlert', alert);
                    console.log(`🚨 Geofence alert: ${uuid} left geofence (${Math.round(distance)}m)`);
                }
            }
            
            // For debugging - log current status
            console.log(`Geofence check: ${uuid} - Distance: ${Math.round(distance)}m, Radius: ${geofence.radius}m, Inside: ${isInside}`);
        }
    } catch (error) {
        console.error('Error checking geofences:', error);
    }
}

// Demo tracking function (simulates GPS updates)
function startDemoTracking(uuid) {
    let lat = 28.6139 + (Math.random() - 0.5) * 0.01; // Smaller area for better testing
    let lng = 77.2090 + (Math.random() - 0.5) * 0.01;
    let heading = Math.random() * 360;
    let stepCount = 0;
    
    const interval = setInterval(async () => {
        stepCount++;
        
        // Simulate movement
        const speed = 30 + Math.random() * 20; // 30-50 km/h
        const distance = (speed / 3600) * 0.002; // Larger steps for more noticeable movement
        
        // Create a pattern that will cross geofence boundaries
        if (stepCount < 5) {
            // Move away from center
            lat += Math.cos(heading * Math.PI / 180) * distance;
            lng += Math.sin(heading * Math.PI / 180) * distance;
        } else if (stepCount < 10) {
            // Move back towards center
            heading = (heading + 180) % 360;
            lat += Math.cos(heading * Math.PI / 180) * distance;
            lng += Math.sin(heading * Math.PI / 180) * distance;
        } else {
            // Reset pattern
            stepCount = 0;
            heading = Math.random() * 360;
        }
        
        // Occasionally change direction for more realistic movement
        if (Math.random() < 0.2) {
            heading += (Math.random() - 0.5) * 90;
        }
        
        // Add location to database
        const location = new Location({
            uuid,
            latitude: lat,
            longitude: lng,
            speed,
            heading
        });
        
        try {
            await location.save();
            io.emit('locationUpdate', location);
            await checkGeofences(uuid, lat, lng);
            console.log(`📍 Demo location update: ${uuid} at (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
        } catch (error) {
            console.error('Error saving demo location:', error);
        }
        
    }, 30000); // Every 30 seconds for faster testing
    
    activeTrackers.set(uuid, interval);
    
    // Also create a default geofence
    setTimeout(async () => {
        try {
            const geofence = new Geofence({
                uuid,
                center_lat: lat,
                center_lng: lng,
                radius: 2000 // 2km radius for demo
            });
            await geofence.save();
            console.log(`✅ Default geofence created for demo UUID: ${uuid}`);
        } catch (error) {
            console.error('Error creating default geofence:', error);
        }
    }, 1000);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('trackUuid', (uuid) => {
        socket.join(`track_${uuid}`);
        console.log(`Client ${socket.id} tracking UUID: ${uuid}`);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Database inspection endpoints
app.get('/api/debug/database', async (req, res) => {
    try {
        const stats = {};
        
        // Get collection counts
        stats.locations_count = await Location.countDocuments();
        stats.geofences_count = await Geofence.countDocuments();
        stats.alerts_count = await Alert.countDocuments();
        
        // Get unique UUIDs
        const uniqueUuids = await Location.distinct('uuid');
        stats.unique_uuids = uniqueUuids.length;
        stats.tracked_uuids = uniqueUuids;
        
        // Get latest locations
        stats.latest_locations = await Location.find()
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();
            
        // Get all geofences
        stats.all_geofences = await Geofence.find().lean();
        
        // Get recent alerts
        stats.recent_alerts = await Alert.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
            
        res.json(stats);
    } catch (error) {
        console.error('Error getting database stats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/debug/clear', async (req, res) => {
    try {
        const deletedLocations = await Location.deleteMany({});
        const deletedGeofences = await Geofence.deleteMany({});
        const deletedAlerts = await Alert.deleteMany({});
        
        res.json({
            message: 'Database cleared',
            deleted: {
                locations: deletedLocations.deletedCount,
                geofences: deletedGeofences.deletedCount,
                alerts: deletedAlerts.deletedCount
            }
        });
    } catch (error) {
        console.error('Error clearing database:', error);
        res.status(500).json({ error: error.message });
    }
});

// Database viewer page
app.get('/database', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'database-viewer.html'));
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
findAvailablePort(3000).then(async (PORT) => {
    // Initialize database first
    await initializeDatabase();
    
    server.listen(PORT, () => {
        console.log(`Fleet Management Server running on port ${PORT}`);
        console.log(`Open http://localhost:${PORT} to view the application`);
    });
}).catch((error) => {
    console.error('Error finding available port:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    
    // Clear all demo tracking intervals
    activeTrackers.forEach(interval => clearInterval(interval));
    
    // Close database
    try {
        await closeDB();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
    
    process.exit(0);
});
