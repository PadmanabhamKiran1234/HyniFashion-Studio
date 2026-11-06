import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// PUBLIC: subscribe to the newsletter. No authentication required.
export async function subscribe(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    const existing = await NewsletterSubscriber.findOne({ email });

    if (existing) {
      return res.status(200).json({
        success: true,
        alreadySubscribed: true,
        message: 'You are already subscribed to the newsletter.'
      });
    }

    try {
      await NewsletterSubscriber.create({
        email,
        source: String(req.body?.source || 'footer').slice(0, 40)
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(200).json({
          success: true,
          alreadySubscribed: true,
          message: 'You are already subscribed to the newsletter.'
        });
      }
      throw error;
    }

    return res.status(201).json({
      success: true,
      alreadySubscribed: false,
      message: 'Thank you for subscribing!'
    });
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to subscribe right now. Please try again.'
    });
  }
}
