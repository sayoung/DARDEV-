import { Controller, Put, Param, Req, Res, HttpException, HttpStatus, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';

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

    let payload: string;
    let signature: string;
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length < 3) throw new Error('Invalid token format');
      // Token is key:expiresAt:signature (signature may have colons if not hex, but it is hex here)
      // Actually payload is key:expiresAt and signature is the rest
      const lastColon = decoded.lastIndexOf(':');
      payload = decoded.substring(0, lastColon);
      signature = decoded.substring(lastColon + 1);
    } catch {
      throw new HttpException('Invalid token', HttpStatus.BAD_REQUEST);
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.env.SESSION_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
    }

    const firstColon = payload.indexOf(':');
    const key = payload.substring(0, firstColon);
    const expiresAt = parseInt(payload.substring(firstColon + 1), 10);

    if (Date.now() > expiresAt) {
      throw new HttpException('Token expired', HttpStatus.FORBIDDEN);
    }

    const localPath = this.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'storage');
    const filePath = path.join(localPath, key);

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    
    const writeStream = fs.createWriteStream(filePath);
    req.raw.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        res.status(200).send();
        resolve(null);
      });
      writeStream.on('error', (err) => {
        res.status(500).send(err.message);
        reject(err);
      });
      req.raw.on('error', (err) => {
        writeStream.destroy();
        res.status(500).send(err.message);
        reject(err);
      });
    });
  }
}
