const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        index: true
    },
    alert_type: {
        type: String,
        required: true,
        enum: ['GEOFENCE_EXIT', 'GEOFENCE_ENTER', 'SPEED_VIOLATION', 'DEVICE_OFFLINE']
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    geofence_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Geofence'
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },
    acknowledged: {
        type: Boolean,
        default: false
    },
    // GeoJSON for the alert location
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    }
}, {
    timestamps: true
});

// Create compound indexes
alertSchema.index({ uuid: 1, createdAt: -1 });
alertSchema.index({ alert_type: 1, acknowledged: 1 });

// Pre-save middleware to set GeoJSON location
alertSchema.pre('save', function(next) {
    if (this.latitude && this.longitude) {
        this.location = {
            type: 'Point',
            coordinates: [this.longitude, this.latitude]
        };
    }
    next();
});

module.exports = mongoose.model('Alert', alertSchema);
