import { writeFileSync } from 'node:fs';

import { openApiDocumentFile, serializeOpenApiDocument } from './registry.js';

writeFileSync(openApiDocumentFile(), serializeOpenApiDocument(), 'utf8');
