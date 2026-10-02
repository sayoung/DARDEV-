export interface StorageService {
  download(key: string): Promise<Buffer>;
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
}
