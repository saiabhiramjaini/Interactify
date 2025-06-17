import { Schema, model } from "mongoose";

const QuestionSchema = new Schema(
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
    upVotedBy: [
      {
        type: String,
        trim: true,
      },
    ],
    authorId: {
      type: String,
      required: true,
      trim: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
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
  { _id: true, timestamps: true }
);

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
        id: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        _id: false
      },
    ],
    questions: [QuestionSchema],
    sessionStatus: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const SessionModel = model("Session", SessionSchema);

export { SessionModel };
