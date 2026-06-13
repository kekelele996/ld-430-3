import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import type { AuthUser } from '../types/interfaces';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  use(req: Request & { user?: AuthUser }, res: Response, next: NextFunction) {
    res.on('finish', () => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        logger.info('audit event', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          userId: req.user?.id,
          userRole: req.user?.role,
          ipAddress: req.ip,
          userAgent: req.header('user-agent'),
        });
      }
    });
    next();
  }
}
