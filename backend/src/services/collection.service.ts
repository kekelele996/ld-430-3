import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, type CollectionDocument } from '../models/collection.schema';
import { AuditAction, CollectionRole } from '../types/enums';
import type { CollaboratorInput, UpdateCollaboratorRoleInput } from '../types/interfaces';
import { AuditLogService } from './auditLog.service';

@Injectable()
export class CollectionService {
  constructor(
    @InjectModel(Collection.name) private readonly collectionModel: Model<CollectionDocument>,
    private readonly auditLogService: AuditLogService,
  ) {}

  findAll() {
    return this.collectionModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const collection = await this.collectionModel.findById(id).exec();
    if (!collection) throw new NotFoundException('素材集不存在');
    return collection;
  }

  create(payload: Partial<Collection>) {
    return this.collectionModel.create(payload);
  }

  async checkEditPermission(collectionId: string, userId: string): Promise<CollectionDocument> {
    const collection = await this.findOne(collectionId);
    if (collection.creatorId === userId) return collection;
    const collaborator = collection.collaborators.find((c) => c.userId === userId && c.role === CollectionRole.Editor);
    if (collaborator) return collection;
    throw new ForbiddenException('没有编辑权限');
  }

  async checkViewPermission(collectionId: string, userId: string): Promise<CollectionDocument> {
    const collection = await this.findOne(collectionId);
    if (collection.isPublic || collection.creatorId === userId) return collection;
    const collaborator = collection.collaborators.find((c) => c.userId === userId);
    if (collaborator) return collection;
    throw new ForbiddenException('没有查看权限');
  }

  async addAsset(collectionId: string, assetId: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.checkEditPermission(collectionId, userId);
    const collection = await this.collectionModel
      .findByIdAndUpdate(collectionId, { $addToSet: { assetIds: new Types.ObjectId(assetId) } }, { new: true })
      .exec();
    await this.auditLogService.create({
      action: AuditAction.AddAsset,
      userId,
      collectionId,
      assetId,
      ipAddress,
      userAgent,
    });
    return collection;
  }

  async removeAsset(collectionId: string, assetId: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.checkEditPermission(collectionId, userId);
    const collection = await this.collectionModel
      .findByIdAndUpdate(collectionId, { $pull: { assetIds: new Types.ObjectId(assetId) } }, { new: true })
      .exec();
    await this.auditLogService.create({
      action: AuditAction.RemoveAsset,
      userId,
      collectionId,
      assetId,
      ipAddress,
      userAgent,
    });
    return collection;
  }

  async addCollaborator(
    collectionId: string,
    input: CollaboratorInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const collection = await this.checkEditPermission(collectionId, userId);
    const existingIndex = collection.collaborators.findIndex((c) => c.userId === input.userId);
    if (existingIndex !== -1) {
      collection.collaborators[existingIndex].role = input.role;
    } else {
      collection.collaborators.push({ userId: input.userId, role: input.role });
    }
    const updated = await collection.save();
    await this.auditLogService.create({
      action: AuditAction.AddCollaborator,
      userId,
      collectionId,
      targetUserId: input.userId,
      newRole: input.role,
      ipAddress,
      userAgent,
    });
    return updated;
  }

  async removeCollaborator(
    collectionId: string,
    targetUserId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.checkEditPermission(collectionId, userId);
    const collection = await this.collectionModel
      .findByIdAndUpdate(
        collectionId,
        { $pull: { collaborators: { userId: targetUserId } } },
        { new: true },
      )
      .exec();
    await this.auditLogService.create({
      action: AuditAction.RemoveCollaborator,
      userId,
      collectionId,
      targetUserId,
      ipAddress,
      userAgent,
    });
    return collection;
  }

  async updateCollaboratorRole(
    collectionId: string,
    targetUserId: string,
    input: UpdateCollaboratorRoleInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const collection = await this.checkEditPermission(collectionId, userId);
    const collaborator = collection.collaborators.find((c) => c.userId === targetUserId);
    if (!collaborator) throw new NotFoundException('协作成员不存在');
    const oldRole = collaborator.role;
    collaborator.role = input.role;
    const updated = await collection.save();
    await this.auditLogService.create({
      action: AuditAction.UpdateCollaboratorRole,
      userId,
      collectionId,
      targetUserId,
      oldRole,
      newRole: input.role,
      ipAddress,
      userAgent,
    });
    return updated;
  }

  async getAuditLogs(collectionId: string, userId: string) {
    await this.checkViewPermission(collectionId, userId);
    return this.auditLogService.findByCollectionId(collectionId);
  }
}
