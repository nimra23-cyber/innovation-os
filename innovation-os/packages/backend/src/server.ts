import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { projectsRouter } from './routes/projects';
import { reportsRouter } from './routes/reports';
import { sseRouter } from './routes/sse';
import { configRouter } from './routes/config';
import logger from './lib/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware stack
app.use(express.json());
app.use(requestLogger);
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/sse', sseRouter);
app.use('/api/config', configRouter);

// Error handler — must be last
app.use(errorHandler);

// Start server when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

export { app };
