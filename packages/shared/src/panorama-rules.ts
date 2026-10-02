export const PANORAMA_MIN_WIDTH = 4096;
export const PANORAMA_MAX_BYTES = 80 * 1024 * 1024;
export const PANORAMA_RATIO = 2;
export const PANORAMA_RATIO_TOLERANCE = 0.01;

export enum PanoramaUploadIssueCode {
  INVALID_FORMAT = 'INVALID_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
  INVALID_RATIO = 'INVALID_RATIO',
}

export interface PanoramaUploadIssue {
  code: PanoramaUploadIssueCode;
  expected: string;
  received: string;
}

export function validatePanoramaUpload(input: {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}): PanoramaUploadIssue[] {
  const issues: PanoramaUploadIssue[] = [];

  if (input.mimeType !== 'image/jpeg') {
    issues.push({
      code: PanoramaUploadIssueCode.INVALID_FORMAT,
      expected: 'image/jpeg',
      received: input.mimeType,
    });
  }

  if (input.sizeBytes > PANORAMA_MAX_BYTES) {
    issues.push({
      code: PanoramaUploadIssueCode.FILE_TOO_LARGE,
      expected: `<= ${PANORAMA_MAX_BYTES.toString()}`,
      received: input.sizeBytes.toString(),
    });
  }

  if (input.width < PANORAMA_MIN_WIDTH) {
    issues.push({
      code: PanoramaUploadIssueCode.INVALID_DIMENSIONS,
      expected: `>= ${PANORAMA_MIN_WIDTH.toString()}`,
      received: input.width.toString(),
    });
  }

  const ratio = input.width / input.height;
  const deviation = Math.abs(ratio - PANORAMA_RATIO) / PANORAMA_RATIO;
  if (deviation > PANORAMA_RATIO_TOLERANCE) {
    issues.push({
      code: PanoramaUploadIssueCode.INVALID_RATIO,
      expected: `~${PANORAMA_RATIO.toString()}`,
      received: ratio.toString(),
    });
  }

  return issues;
}
