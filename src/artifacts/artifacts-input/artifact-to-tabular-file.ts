import type { Artifact } from '../artifact';
import type { TabularFile } from '~/src/ui/tabular-file-input/tabular-file';

/**
 * Converts an Artifact entity to a TabularFile for use in file list components.
 * The TabularFile will use the artifact's download URL for lazy loading.
 */
export function artifactToTabularFile(artifact: Artifact): TabularFile {
  return {
    id: artifact.id,
    name: artifact.name || artifact.filename,
    downloadUrl: artifact.download_url || '',
    size: artifact.size,
    contentType: artifact.content_type,
  };
}

/**
 * Converts an array of Artifact entities to TabularFile array
 */
export function artifactsToTabularFiles(artifacts: Artifact[]): TabularFile[] {
  return artifacts.map(artifactToTabularFile);
}
