import mongoose from 'mongoose';

export function getHealth(req, res) {
  const states = [
    'disconnected',
    'connected',
    'connecting',
    'disconnecting'
  ];

  const databaseState =
    states[mongoose.connection.readyState] || 'unknown';

  const connected = mongoose.connection.readyState === 1;

  return res.status(connected ? 200 : 503).json({
    success: connected,

    message: connected
      ? 'Hyni Fashion Studio API is running.'
      : 'MongoDB is not connected.',

    data: {
      api: 'healthy',
      database: databaseState,
      databaseName: mongoose.connection.name || null,
      timestamp: new Date().toISOString()
    }
  });
}