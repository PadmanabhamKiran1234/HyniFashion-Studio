import mongoose from 'mongoose';

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    source: {
      type: String,
      default: 'footer',
      trim: true
    },

    subscribedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const NewsletterSubscriber = mongoose.model(
  'NewsletterSubscriber',
  newsletterSubscriberSchema
);

export default NewsletterSubscriber;
