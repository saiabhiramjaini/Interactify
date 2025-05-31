import { Schema, model } from "mongoose";

// Main Session schema with embedded questions
const SessionSchema = new Schema(
  {
    sessionName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    attendees: [
      {
        type: String,
        trim: true,
      },
    ],
    questions: [
      {
        questionText: {
          type: String,
          required: true,
          trim: true,
        },
        upVotes: {
          type: Number,
          default: 0,
          min: 0,
        },
        downVotes: {
          type: Number,
          default: 0,
          min: 0,
        },
        author: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        answered: {
          type: Boolean,
          default: false,
        },
        highlighted: {
          type: Boolean,
          default: false,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Indexes for better query performance
SessionSchema.index({ roomId: 1 });
SessionSchema.index({ owner: 1 });
SessionSchema.index({ createdAt: -1 });
SessionSchema.index({ "questions.author": 1 });
SessionSchema.index({ "questions.answered": 1 });
SessionSchema.index({ "questions.highlighted": 1 });

// Create and export the model
const SessionModel = model("Session", SessionSchema);

export { SessionModel };
