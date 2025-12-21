import fs from 'fs/promises';
import path from 'path';
import colors from 'tailwindcss/colors';
import type { Logger } from '../lib/logger';

/**
 * Generates the sparkles.svg file with gradient fill.
 */
export async function generateSparklesSvg({
  logger,
  outputDir,
}: {
  logger: Logger;
  outputDir?: string;
}) {
  // Path data extracted from IconSparkles component in icons.tsx
  const sparklesPathData = `M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z`;

  // Gradient colors from Sparkles component
  const fuchsia400 = colors.fuchsia[400];
  const fuchsia500 = colors.fuchsia[500];
  const fuchsia600 = colors.fuchsia[600];

  // Generate the SVG content
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <defs>
        <radialGradient id="sparkles-svg-linear-gradient" cx="50%" cy="50%" r="80%">
            <stop offset="0%" style="stop-color:${fuchsia400};stop-opacity:1" />
            <stop offset="60%" style="stop-color:${fuchsia500};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${fuchsia600};stop-opacity:1" />
        </radialGradient>
    </defs>
    <path fill="url(#sparkles-svg-linear-gradient)" fill-rule="evenodd" d="${sparklesPathData}" clip-rule="evenodd" />
</svg>
`;

  try {
    const outputDirFinal = outputDir || __dirname;
    const outputPath = path.join(outputDirFinal, 'sparkles.svg');
    await fs.writeFile(outputPath, svgContent, 'utf-8');
    logger.info(`✨ Successfully generated sparkles.svg at ${outputPath}`);
  } catch (error) {
    logger.error('Failed to generate sparkles.svg', { error });
  }
}
