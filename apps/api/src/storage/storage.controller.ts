import { Controller, Put, Get, Param, Req, Res, HttpException, HttpStatus, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { verifyStorageToken } from './storage.utils.js';

@Controller('storage')
export class StorageController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Put('upload/:token')
  async upload(
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    if (this.env.STORAGE_PROVIDER !== 'local') {
      throw new HttpException('Not using local storage', HttpStatus.BAD_REQUEST);
    }

    let key: string;
    let sizeBytes: number;
    try {
      const verified = verifyStorageToken(token, this.env.SESSION_SECRET);
      key = verified.key;
      sizeBytes = verified.sizeBytes;
    } catch (error: unknown) {
      const e = error as Error;
      if (e.message === 'Token expired') {
        throw new HttpException('Token expired', HttpStatus.FORBIDDEN);
      } else if (e.message === 'Invalid signature') {
        throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
      }
      throw new HttpException('Invalid token', HttpStatus.BAD_REQUEST);
    }

    const localPath = path.resolve(this.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'));
    const filePath = path.resolve(localPath, key);

    if (!filePath.startsWith(localPath)) {
      throw new HttpException('Invalid key', HttpStatus.BAD_REQUEST);
    }

    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > sizeBytes) {
      throw new HttpException('Payload too large', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    
    const writeStream = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      let written = 0;
      req.raw.on('data', (chunk: Buffer) => {
        written += chunk.length;
        if (written > sizeBytes) {
          const err = new Error('Payload too large');
          writeStream.destroy(err);
          req.raw.destroy(err);
        }
      });

      req.raw.pipe(writeStream);

      writeStream.on('finish', () => {
        res.status(200).send();
        resolve(null);
      });
      writeStream.on('error', (err) => {
        if (err.message === 'Payload too large') {
          res.status(413).send(err.message);
        } else {
          res.status(500).send(err.message);
        }
        reject(err);
      });
      req.raw.on('error', (err) => {
        writeStream.destroy();
        if (err.message === 'Payload too large') {
          res.status(413).send(err.message);
        } else {
          res.status(500).send(err.message);
        }
        reject(err);
      });
    });
  }

  @Get('download/:token')
  async download(
    @Param('token') token: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    if (this.env.STORAGE_PROVIDER !== 'local') {
      throw new HttpException('Not using local storage', HttpStatus.BAD_REQUEST);
    }

    let key: string;
    try {
      const verified = verifyStorageToken(token, this.env.SESSION_SECRET);
      key = verified.key;
    } catch (error: unknown) {
      const e = error as Error;
      if (e.message === 'Token expired') {
        throw new HttpException('Token expired', HttpStatus.FORBIDDEN);
      } else if (e.message === 'Invalid signature') {
        throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
      }
      throw new HttpException('Invalid token', HttpStatus.BAD_REQUEST);
    }

    const localPath = path.resolve(this.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage'));
    const filePath = path.resolve(localPath, key);

    if (!filePath.startsWith(localPath)) {
      throw new HttpException('Invalid key', HttpStatus.BAD_REQUEST);
    }

    try {
      const stat = await fs.promises.stat(filePath);
      res.header('Content-Length', stat.size);
      const readStream = fs.createReadStream(filePath);
      await res.send(readStream);
      return;
    } catch {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
  }
}
