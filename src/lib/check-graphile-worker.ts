import { createDb, cleanupDb } from '../shared/sql';
import { createLogger } from './logger';
import { checkGraphileWorkerSetup } from '../shared/graphile-worker';

const main = async () => {
  const logger = createLogger();

  try {
    logger.info('Checking Graphile Worker setup...');
    const db = await createDb({ logger });

    const result = await checkGraphileWorkerSetup(db, logger);

    console.log('\n📊 Graphile Worker Setup Status:');
    console.log('================================');
    console.log(`Schema exists: ${result.schemaExists ? '✅' : '❌'}`);
    console.log(`Function exists: ${result.functionExists ? '✅' : '❌'}`);
    console.log(`Overall status: ${result.isSetup ? '✅ Ready' : '❌ Not Ready'}`);

    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }

    if (!result.isSetup) {
      console.log('\n💡 To fix: Run the worker at least once to initialize the schema:');
      console.log('   bun run worker');
      process.exit(1);
    } else {
      console.log('\n✅ Graphile Worker is properly set up!');
      process.exit(0);
    }
  } catch (error) {
    logger.error('Failed to check Graphile Worker setup', { error });
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await cleanupDb(logger);
  }
};

main();
