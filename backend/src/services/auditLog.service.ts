import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, type AuditLogDocument } from '../models/auditLog.schema';
import type { AuditLogInput } from '../types/interfaces';

@Injectable()
export class AuditLogService {
  constructor(@InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>) {}

  async create(input: AuditLogInput) {
    const log = new this.auditLogModel({
      ...input,
      collectionId: new Types.ObjectId(input.collectionId),
      assetId: input.assetId ? new Types.ObjectId(input.assetId) : undefined,
    });
    return log.save();
  }

  async findByCollectionId(collectionId: string, limit = 100) {
    return this.auditLogModel
      .find({ collectionId: new Types.ObjectId(collectionId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByUserId(userId: string, limit = 100) {
    return this.auditLogModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
