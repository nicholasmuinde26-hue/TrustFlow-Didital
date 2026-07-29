import app from './app.js';
import env from './config/env.js';
import { connectDatabase } from './config/database.js';




const startServer = async () => {
  try {

    // ========================================
    // CONNECT DATABASE
    // ========================================

    await connectDatabase();


    // ========================================
    // START SERVER
    // ========================================

    app.listen(env.port, () => {

      console.log('');
      console.log('========================================');
      console.log('  ChamaManager API');
      console.log('========================================');
      console.log('');

      console.log(
        `  Environment: ${env.nodeEnv}`
      );

      console.log(
        `  Server:      http://localhost:${env.port}`
      );

      console.log(
        `  Health:      http://localhost:${env.port}/api/v1/health`
      );

      console.log('');
      console.log('========================================');

    });

  } catch (error) {

    console.error(
      'Failed to start ChamaManager:',
      error
    );

    process.exit(1);
  }
};

startServer();