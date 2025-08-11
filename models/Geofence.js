const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        index: true
    },
    center_lat: {
        type: Number,
        required: true
    },
    center_lng: {
        type: Number,
        required: true
    },
    radius: {
        type: Number,
        required: true,
        default: 1000 // 1km in meters
    },
    is_active: {
        type: Boolean,
        default: true
    },
    lastKnownState: {
        type: Boolean,
        default: undefined // undefined = not checked yet, true = inside, false = outside
    }
}, {
    timestamps: true
});

// Create compound index
geofenceSchema.index({ uuid: 1, is_active: 1 });

module.exports = mongoose.model('Geofence', geofenceSchema);
