const mongoose = require('mongoose');

let UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            maxLength: 20,
            minLength: 1
        },
        password: { type: String, required: true },
        rating: { type: Number, default: 0 },
        postHistory: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Post'
            }
        ]
    },
    // Adds only createdAt field
    {
        timestamps: { createdAt: true, updatedAt: false }
    }
)

module.exports = mongoose.model('User', UserSchema);