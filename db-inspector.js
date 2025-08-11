// MongoDB Database Inspector Script
// Run this script to check your database contents

const { connectDB, closeDB } = require('./config/database');
const Location = require('./models/Location');
const Geofence = require('./models/Geofence');
const Alert = require('./models/Alert');

async function inspectDatabase() {
    try {
        // Connect to database
        await connectDB();
        console.log('🔗 Connected to MongoDB\n');

        // Get collection counts
        const locationCount = await Location.countDocuments();
        const geofenceCount = await Geofence.countDocuments();
        const alertCount = await Alert.countDocuments();

        console.log('📊 DATABASE STATISTICS:');
        console.log('========================');
        console.log(`📍 Location records: ${locationCount}`);
        console.log(`🔶 Geofences: ${geofenceCount}`);
        console.log(`⚠️  Alerts: ${alertCount}\n`);

        // Get unique UUIDs
        const uniqueUuids = await Location.distinct('uuid');
        console.log(`🚛 Tracked vehicles: ${uniqueUuids.length}`);
        if (uniqueUuids.length > 0) {
            console.log('Vehicle UUIDs:');
            uniqueUuids.forEach((uuid, index) => {
                console.log(`  ${index + 1}. ${uuid}`);
            });
        }
        console.log('');

        // Get latest locations
        const latestLocations = await Location.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .lean();

        if (latestLocations.length > 0) {
            console.log('📍 LATEST LOCATION UPDATES:');
            console.log('============================');
            latestLocations.forEach((loc, index) => {
                console.log(`${index + 1}. UUID: ${loc.uuid.substring(0, 12)}...`);
                console.log(`   📍 Position: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`);
                console.log(`   🏃 Speed: ${Math.round(loc.speed || 0)} km/h`);
                console.log(`   ⏰ Time: ${new Date(loc.timestamp).toLocaleString()}\n`);
            });
        } else {
            console.log('📍 No location data found\n');
        }

        // Get all geofences
        const geofences = await Geofence.find().lean();
        if (geofences.length > 0) {
            console.log('🔶 ACTIVE GEOFENCES:');
            console.log('====================');
            geofences.forEach((geo, index) => {
                console.log(`${index + 1}. UUID: ${geo.uuid.substring(0, 12)}...`);
                console.log(`   📍 Center: ${geo.center_lat.toFixed(6)}, ${geo.center_lng.toFixed(6)}`);
                console.log(`   📏 Radius: ${geo.radius}m`);
                console.log(`   ✅ Active: ${geo.is_active ? 'Yes' : 'No'}\n`);
            });
        } else {
            console.log('🔶 No geofences found\n');
        }

        // Get recent alerts
        const alerts = await Alert.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        if (alerts.length > 0) {
            console.log('⚠️  RECENT ALERTS:');
            console.log('==================');
            alerts.forEach((alert, index) => {
                console.log(`${index + 1}. ${alert.alert_type} - ${alert.severity}`);
                console.log(`   🚛 UUID: ${alert.uuid.substring(0, 12)}...`);
                console.log(`   📝 Message: ${alert.message}`);
                console.log(`   ⏰ Time: ${new Date(alert.createdAt).toLocaleString()}\n`);
            });
        } else {
            console.log('⚠️  No alerts found\n');
        }

        // Database size estimation
        const totalDocs = locationCount + geofenceCount + alertCount;
        console.log('💾 STORAGE SUMMARY:');
        console.log('===================');
        console.log(`📄 Total documents: ${totalDocs}`);
        console.log(`📦 Estimated size: ~${(totalDocs * 0.5).toFixed(1)} KB`);

    } catch (error) {
        console.error('❌ Error inspecting database:', error);
    } finally {
        await closeDB();
        console.log('\n🔐 Database connection closed');
        process.exit(0);
    }
}

// Command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🔍 MongoDB Database Inspector');
    console.log('============================');
    console.log('Usage: node db-inspector.js [options]');
    console.log('\nOptions:');
    console.log('  --help, -h    Show this help message');
    console.log('  --clear       Clear all database data');
    console.log('\nExamples:');
    console.log('  node db-inspector.js          # Inspect database');
    console.log('  node db-inspector.js --clear  # Clear all data');
    process.exit(0);
}

if (args.includes('--clear')) {
    console.log('⚠️  Are you sure you want to clear ALL database data?');
    console.log('This action cannot be undone!');
    console.log('Run the following command to continue:');
    console.log('node -e "require(\'./db-inspector.js\').clearDatabase()"');
    process.exit(0);
}

// Export functions for use in other scripts
module.exports = {
    inspectDatabase,
    clearDatabase: async function() {
        await connectDB();
        const deletedLocations = await Location.deleteMany({});
        const deletedGeofences = await Geofence.deleteMany({});
        const deletedAlerts = await Alert.deleteMany({});
        
        console.log('🗑️  Database cleared!');
        console.log(`Deleted: ${deletedLocations.deletedCount} locations, ${deletedGeofences.deletedCount} geofences, ${deletedAlerts.deletedCount} alerts`);
        
        await closeDB();
        process.exit(0);
    }
};

// Run inspection if called directly
if (require.main === module) {
    inspectDatabase();
}
