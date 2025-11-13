const mongoose = require("mongoose");
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");
const dotenv = require("dotenv");

dotenv.config();

const slotSchema = new mongoose.Schema(
    {
        day: {
            type: String,
            required: true,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            index: true,
        },

        start_time: {
            type: String,
            required: true,
            trim: true,
        },

        end_time: {
            type: String,
            required: true,
            trim: true,
        },

        // Slot status
        is_active: {
            type: Boolean,
            default: true,
        },

        // Created by admin
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Soft delete fields
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
    },
    { timestamps: true }
);

// --- Plugins ---
slotSchema.plugin(mongooseLeanVirtuals);

// --- Indexes ---
slotSchema.index({ day: 1, start_time: 1 });
slotSchema.index({ is_active: 1 });

// --- Pre Hooks for queries ---
slotSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

slotSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance methods ---
slotSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

slotSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Virtuals ---
slotSchema.virtual('time_range').get(function () {
    return `${this.start_time} - ${this.end_time}`;
});

// --- Model export ---
module.exports = mongoose.model("Slot", slotSchema);

