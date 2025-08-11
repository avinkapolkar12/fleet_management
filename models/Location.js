const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        index: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    speed: {
        type: Number,
        default: 0
    },
    heading: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    // GeoJSON for geospatial queries
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

// Create compound index for efficient queries
locationSchema.index({ uuid: 1, timestamp: -1 });

// Pre-save middleware to set GeoJSON location
locationSchema.pre('save', function(next) {
    if (this.latitude && this.longitude) {
        this.location = {
            type: 'Point',
            coordinates: [this.longitude, this.latitude]
        };
    }
    next();
});

module.exports = mongoose.model('Location', locationSchema);
