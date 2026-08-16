import { contentManifest } from "../content/manifest.js";
import { isContentIndexable } from "../content/utils.js";
import { validateContentManifest } from "../content/validation.js";

try {
  await validateContentManifest(contentManifest);
  const indexable = contentManifest.filter(isContentIndexable);
  console.log(`Publication Gate Passed: ${contentManifest.length} records reviewed, ${indexable.length} indexable.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
