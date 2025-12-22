import type { LLM } from '~/src/lib/llm/llm';
import type { Logger } from '~/src/lib/logger';
import type { ObjectLocation } from '~/src/lib/object-store/object-location';
import type { ObjectStore } from '~/src/lib/object-store/object-store';
import { Err, isErr, Ok, type Result } from '~/src/lib/result';
import type { SqlDb } from '~/src/lib/sql-db/sql-db';
import {
  createTabularDataPostgresImporter,
  type BatchImportResult,
  type ImportRequest,
} from '~/src/lib/tabular-data-postgres-importer/tabular-data-postgres-importer';
import { createPgliteSqlDb } from '~/src/shared/sql-db';
import {
  getExtension,
  getFormatFromKey,
  type TabularFormat,
} from '../tabular-data-format/tabular-data-format';
import {
  createTabularDataPostgresExporter,
  type BatchExportResult,
  type ExportRequest,
} from '../tabular-data-postgres-exporter/tabular-data-postgres-exporter';
import { generatePostgresScript } from './generate-postgres-script';

export class Normalizer {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly logger: Logger,
    private readonly llm: LLM,
  ) {}

  /**
   * Normalizes objects by processing inputs against targets and producing outputs.
   * Reads all inputs and targets, processes them according to normalization logic,
   * and writes outputs to the specified bucket with keys generated from the prefix.
   */
  async normalize(params: {
    targets: ObjectLocation[];
    inputs: ObjectLocation[];
    outputObjectKeyPrefix: string;
    outputObjectBucket: string;
  }): Promise<Result<{ outputs: ObjectLocation[] }, string>> {
    if (params.inputs.length === 0) {
      this.logger.error('Normalization failed: No inputs provided');
      return Ok({ outputs: [] });
    }

    const sqlDb = await createPgliteSqlDb({ logger: this.logger });

    const inputs = params.inputs.map((objLoc, index): ObjectLocation & { viewName: string } => ({
      ...objLoc,
      viewName: `input_${index}`,
    }));
    const targets = params.targets.map((objLoc, index): ObjectLocation & { viewName: string } => ({
      ...objLoc,
      viewName: `target_${index}`,
    }));
    const exportFormat = getFormatFromKey(params.targets[0]?.key || params.inputs[0]?.key || '');
    const exportExtension = getExtension(exportFormat);
    const outputs = params.targets.map((_, index): ObjectLocation & { viewName: string } => ({
      key: `${params.outputObjectKeyPrefix}output_${index}.${exportExtension}`,
      bucket: params.outputObjectBucket,
      viewName: `output_${index}`,
    }));

    const importedBatch = await this.importTabularData({
      sqlDb,
      inputs,
      targets,
    });

    if (isErr(importedBatch.result)) {
      this.logger.error('Failed to import tabular data', { error: importedBatch.result.error });
      return importedBatch.result;
    }

    this.logger.debug('Normalizing objects', {
      inputCount: params.inputs.length,
      targetCount: params.targets.length,
      outputObjectKeyPrefix: params.outputObjectKeyPrefix,
      outputObjectBucket: params.outputObjectBucket,
    });

    const generated = await generatePostgresScript({
      inputs,
      targets,
      outputs,
      llm: this.llm,
      sqlDb,
      logger: this.logger,
    });

    this.logger.debug('Generated Postgres script', {
      explanation: generated.explanation,
      postgresScript: generated.postgresScript,
    });

    console.log(generated.postgresScript);

    if (!generated.postgresScript) {
      this.logger.error('No Postgres script generated');
      return Err('No Postgres script generated');
    }

    const executed = await sqlDb.unsafe(generated.postgresScript);
    if (isErr(executed)) {
      this.logger.error('Failed to execute Postgres script', { error: executed.error });
      return Err(`Failed to execute Postgres script: ${executed.error}`);
    }

    const format = getFormatFromKey(params.targets[0]?.key || params.inputs[0]?.key || '');

    const exported = await this.exportTabularData({
      sqlDb,
      outputs,
      exportFormat: format,
    });

    if (isErr(exported.result)) {
      this.logger.error('Failed to export tabular data', { error: exported.result.error });
      return Err(`Failed to export tabular data: ${exported.result.error}`);
    }

    return Ok({ outputs });
  }

  /**
   * Imports tabular data from inputs and targets into PostgreSQL tables.
   */
  private async importTabularData(params: {
    sqlDb: SqlDb;
    inputs: (ObjectLocation & { viewName: string })[];
    targets: (ObjectLocation & { viewName: string })[];
  }): Promise<BatchImportResult> {
    const { sqlDb, inputs, targets } = params;
    const tabularDataPostgresImporter = createTabularDataPostgresImporter({
      sql: sqlDb,
      logger: this.logger,
      objectStore: this.objectStore,
    });

    const importRequests: ImportRequest[] = [
      ...inputs.map(
        (objLoc): ImportRequest => ({
          bucket: objLoc.bucket,
          key: objLoc.key,
          viewName: objLoc.viewName,
          dropIfExists: true,
        }),
      ),
      ...targets.map(
        (objLoc): ImportRequest => ({
          bucket: objLoc.bucket,
          key: objLoc.key,
          viewName: objLoc.viewName,
          dropIfExists: true,
        }),
      ),
    ];

    const result = await tabularDataPostgresImporter.importBatch(importRequests);

    return result;
  }

  /**
   * Imports tabular data from inputs and targets into PostgreSQL tables.
   */
  private async exportTabularData(params: {
    sqlDb: SqlDb;
    outputs: (ObjectLocation & { viewName: string })[];
    exportFormat: TabularFormat;
  }): Promise<BatchExportResult> {
    const { sqlDb, outputs, exportFormat } = params;
    const tabularDataPostgresExporter = createTabularDataPostgresExporter({
      sql: sqlDb,
      logger: this.logger,
      objectStore: this.objectStore,
    });

    const exportRequests: ExportRequest[] = [
      ...outputs.map(
        (objLoc): ExportRequest => ({
          bucket: objLoc.bucket,
          key: objLoc.key,
          format: exportFormat,
          query: `SELECT * FROM ${objLoc.viewName}`,
        }),
      ),
    ];

    const result = await tabularDataPostgresExporter.exportBatch(exportRequests);

    return result;
  }
}

export function createNormalizer(params: {
  objectStore: ObjectStore;
  logger: Logger;
  llm: LLM;
}): Normalizer {
  return new Normalizer(params.objectStore, params.logger.child(Normalizer.name), params.llm);
}
