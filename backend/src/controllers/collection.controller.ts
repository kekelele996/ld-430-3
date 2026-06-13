import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Collection } from '../models/collection.schema';
import { COLLECTION_ROUTES } from '../routes/collection.routes';
import { CollectionService } from '../services/collection.service';
import type { AuthUser, CollaboratorInput, UpdateCollaboratorRoleInput } from '../types/interfaces';
import { ok } from '../utils/response';

@ApiTags('collections')
@Controller(COLLECTION_ROUTES.root)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  async findAll() {
    return ok(await this.collectionService.findAll());
  }

  @Get(COLLECTION_ROUTES.detail)
  async findOne(@Param('id') id: string, @Req() req: Request & { user?: AuthUser }) {
    return ok(await this.collectionService.checkViewPermission(id, req.user?.id ?? ''));
  }

  @Post()
  async create(@Body() payload: Partial<Collection>) {
    return ok(await this.collectionService.create(payload), '收藏夹已创建');
  }

  @Patch(COLLECTION_ROUTES.addAsset)
  async addAsset(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Req() req: Request & { user?: AuthUser },
  ) {
    const userId = req.user?.id ?? '';
    const ipAddress = req.ip;
    const userAgent = req.header('user-agent');
    return ok(await this.collectionService.addAsset(id, assetId, userId, ipAddress, userAgent), '素材已加入收藏夹');
  }

  @Delete(COLLECTION_ROUTES.removeAsset)
  async removeAsset(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Req() req: Request & { user?: AuthUser },
  ) {
    const userId = req.user?.id ?? '';
    const ipAddress = req.ip;
    const userAgent = req.header('user-agent');
    return ok(await this.collectionService.removeAsset(id, assetId, userId, ipAddress, userAgent), '素材已从收藏夹移除');
  }

  @Post(COLLECTION_ROUTES.addCollaborator)
  async addCollaborator(
    @Param('id') id: string,
    @Body() input: CollaboratorInput,
    @Req() req: Request & { user?: AuthUser },
  ) {
    const userId = req.user?.id ?? '';
    const ipAddress = req.ip;
    const userAgent = req.header('user-agent');
    return ok(await this.collectionService.addCollaborator(id, input, userId, ipAddress, userAgent), '协作成员已添加');
  }

  @Delete(COLLECTION_ROUTES.removeCollaborator)
  async removeCollaborator(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Req() req: Request & { user?: AuthUser },
  ) {
    const userId = req.user?.id ?? '';
    const ipAddress = req.ip;
    const userAgent = req.header('user-agent');
    return ok(await this.collectionService.removeCollaborator(id, targetUserId, userId, ipAddress, userAgent), '协作成员已移除');
  }

  @Patch(COLLECTION_ROUTES.updateCollaboratorRole)
  async updateCollaboratorRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() input: UpdateCollaboratorRoleInput,
    @Req() req: Request & { user?: AuthUser },
  ) {
    const userId = req.user?.id ?? '';
    const ipAddress = req.ip;
    const userAgent = req.header('user-agent');
    return ok(await this.collectionService.updateCollaboratorRole(id, targetUserId, input, userId, ipAddress, userAgent), '协作成员角色已更新');
  }

  @Get(COLLECTION_ROUTES.auditLogs)
  async getAuditLogs(@Param('id') id: string, @Req() req: Request & { user?: AuthUser }) {
    return ok(await this.collectionService.getAuditLogs(id, req.user?.id ?? ''));
  }
}
