import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { Collection } from '../models/collection.schema';
import { CollectionRole } from '../types/enums';
import { AuditLogService } from './auditLog.service';
import { CollectionService } from './collection.service';

type MockCollectionModel = Partial<Model<Collection>> & {
  findById: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  findByIdAndUpdate: jest.Mock;
};

type MockAuditLogService = Partial<AuditLogService> & {
  create: jest.Mock;
  findByCollectionId: jest.Mock;
};

describe('CollectionService', () => {
  let service: CollectionService;
  let collectionModel: MockCollectionModel;
  let auditLogService: MockAuditLogService;

  const mockCollectionId = new Types.ObjectId().toString();
  const mockCreatorId = 'creator-123';
  const mockEditorId = 'editor-456';
  const mockViewerId = 'viewer-789';
  const mockStrangerId = 'stranger-000';
  const mockAssetId = new Types.ObjectId().toString();

  type MockCollection = {
    _id: string;
    name: string;
    creatorId: string;
    isPublic: boolean;
    collaborators: Array<{ userId: string; role: CollectionRole }>;
    assetIds: Types.ObjectId[];
    save?: jest.Mock;
  };

  let mockPublicCollection: MockCollection;
  let mockPrivateCollection: MockCollection;
  let mockAuditLogs: Awaited<ReturnType<AuditLogService['findByCollectionId']>>;

  const createMockCollection = (isPublic: boolean, withSave = false): MockCollection => {
    const collection: MockCollection = {
      _id: mockCollectionId,
      name: 'Test Collection',
      creatorId: mockCreatorId,
      isPublic,
      collaborators: [
        { userId: mockEditorId, role: CollectionRole.Editor },
        { userId: mockViewerId, role: CollectionRole.Viewer },
      ],
      assetIds: [new Types.ObjectId(mockAssetId)],
    };
    if (withSave) {
      collection.save = jest.fn().mockResolvedValue(collection);
    }
    return collection;
  };

  const createMockAuditLogs = () =>
    [
      { _id: 'log-3', action: 'AddAsset', createdAt: new Date('2025-06-15') },
      { _id: 'log-2', action: 'AddCollaborator', createdAt: new Date('2025-06-14') },
      { _id: 'log-1', action: 'RemoveAsset', createdAt: new Date('2025-06-13') },
    ] as unknown as Awaited<ReturnType<AuditLogService['findByCollectionId']>>;

  const mockExec = { exec: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPublicCollection = createMockCollection(true);
    mockPrivateCollection = createMockCollection(false);
    mockAuditLogs = createMockAuditLogs();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        {
          provide: getModelToken(Collection.name),
          useValue: {
            findById: jest.fn(),
            find: jest.fn(() => mockExec),
            create: jest.fn(),
            findByIdAndUpdate: jest.fn(() => mockExec),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            create: jest.fn(),
            findByCollectionId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
    collectionModel = module.get(getModelToken(Collection.name));
    auditLogService = module.get(AuditLogService);
  });

  describe('checkViewPermission', () => {
    it('should allow access for public collection to any user', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPublicCollection) });
      const result = await service.checkViewPermission(mockCollectionId, mockStrangerId);
      expect(result).toEqual(mockPublicCollection);
    });

    it('should allow access for creator on private collection', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      const result = await service.checkViewPermission(mockCollectionId, mockCreatorId);
      expect(result).toEqual(mockPrivateCollection);
    });

    it('should allow access for editor collaborator on private collection', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      const result = await service.checkViewPermission(mockCollectionId, mockEditorId);
      expect(result).toEqual(mockPrivateCollection);
    });

    it('should allow access for viewer collaborator on private collection', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      const result = await service.checkViewPermission(mockCollectionId, mockViewerId);
      expect(result).toEqual(mockPrivateCollection);
    });

    it('should throw ForbiddenException for stranger on private collection', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.checkViewPermission(mockCollectionId, mockStrangerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when collection does not exist', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.checkViewPermission(mockCollectionId, mockCreatorId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkEditPermission', () => {
    it('should allow edit access for creator', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      const result = await service.checkEditPermission(mockCollectionId, mockCreatorId);
      expect(result).toEqual(mockPrivateCollection);
    });

    it('should allow edit access for editor collaborator', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      const result = await service.checkEditPermission(mockCollectionId, mockEditorId);
      expect(result).toEqual(mockPrivateCollection);
    });

    it('should throw ForbiddenException for viewer collaborator', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.checkEditPermission(mockCollectionId, mockViewerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for stranger', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.checkEditPermission(mockCollectionId, mockStrangerId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should return 403 Forbidden when stranger accesses private collection logs', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.getAuditLogs(mockCollectionId, mockStrangerId)).rejects.toThrow(ForbiddenException);
      expect(auditLogService.findByCollectionId).not.toHaveBeenCalled();
    });

    it('should return 403 Forbidden when viewer without collaborator accesses private logs', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.getAuditLogs(mockCollectionId, mockStrangerId)).rejects.toThrow(ForbiddenException);
      expect(auditLogService.findByCollectionId).not.toHaveBeenCalled();
    });

    it('should allow creator to view audit logs and return sorted by time descending', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      auditLogService.findByCollectionId.mockResolvedValue(mockAuditLogs);

      const result = await service.getAuditLogs(mockCollectionId, mockCreatorId);

      expect(auditLogService.findByCollectionId).toHaveBeenCalledWith(mockCollectionId);
      expect(result).toEqual(mockAuditLogs);
      const logs = result as unknown as Array<{ createdAt: Date }>;
      expect(logs[0].createdAt.getTime()).toBeGreaterThan(logs[1].createdAt.getTime());
      expect(logs[1].createdAt.getTime()).toBeGreaterThan(logs[2].createdAt.getTime());
    });

    it('should allow editor collaborator to view audit logs', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      auditLogService.findByCollectionId.mockResolvedValue(mockAuditLogs);

      const result = await service.getAuditLogs(mockCollectionId, mockEditorId);

      expect(auditLogService.findByCollectionId).toHaveBeenCalledWith(mockCollectionId);
      expect(result).toEqual(mockAuditLogs);
    });

    it('should allow viewer collaborator to view audit logs', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      auditLogService.findByCollectionId.mockResolvedValue(mockAuditLogs);

      const result = await service.getAuditLogs(mockCollectionId, mockViewerId);

      expect(auditLogService.findByCollectionId).toHaveBeenCalledWith(mockCollectionId);
      expect(result).toEqual(mockAuditLogs);
    });

    it('should allow anyone to view audit logs for public collection', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPublicCollection) });
      auditLogService.findByCollectionId.mockResolvedValue(mockAuditLogs);

      const result = await service.getAuditLogs(mockCollectionId, mockStrangerId);

      expect(auditLogService.findByCollectionId).toHaveBeenCalledWith(mockCollectionId);
      expect(result).toEqual(mockAuditLogs);
    });

    it('should check permission BEFORE querying logs (await is properly used)', async () => {
      const callOrder: string[] = [];
      const checkViewPermissionSpy = jest
        .spyOn(service, 'checkViewPermission')
        .mockImplementation(async () => {
          callOrder.push('checkViewPermission');
          return mockPrivateCollection as never;
        });
      auditLogService.findByCollectionId.mockImplementation(async () => {
        callOrder.push('findByCollectionId');
        return mockAuditLogs;
      });

      await service.getAuditLogs(mockCollectionId, mockCreatorId);

      expect(callOrder).toEqual(['checkViewPermission', 'findByCollectionId']);
      expect(checkViewPermissionSpy).toHaveBeenCalledWith(mockCollectionId, mockCreatorId);
    });
  });

  describe('addAsset', () => {
    it('should allow editor to add asset and record audit log', async () => {
      const mockUpdatedCollection = { ...mockPrivateCollection };
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      collectionModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUpdatedCollection) });

      const result = await service.addAsset(mockCollectionId, mockAssetId, mockEditorId, '127.0.0.1', 'TestAgent');

      expect(result).toEqual(mockUpdatedCollection);
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AddAsset',
          userId: mockEditorId,
          collectionId: mockCollectionId,
          assetId: mockAssetId,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent',
        }),
      );
    });

    it('should throw ForbiddenException when viewer tries to add asset', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.addAsset(mockCollectionId, mockAssetId, mockViewerId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(collectionModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(auditLogService.create).not.toHaveBeenCalled();
    });
  });

  describe('removeAsset', () => {
    it('should allow editor to remove asset and record audit log', async () => {
      const mockUpdatedCollection = { ...mockPrivateCollection, assetIds: [] };
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      collectionModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUpdatedCollection) });

      const result = await service.removeAsset(mockCollectionId, mockAssetId, mockEditorId);

      expect(result).toEqual(mockUpdatedCollection);
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RemoveAsset',
          userId: mockEditorId,
          collectionId: mockCollectionId,
          assetId: mockAssetId,
        }),
      );
    });

    it('should throw ForbiddenException when viewer tries to remove asset', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.removeAsset(mockCollectionId, mockAssetId, mockViewerId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(collectionModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(auditLogService.create).not.toHaveBeenCalled();
    });
  });

  describe('addCollaborator', () => {
    it('should allow creator to add collaborator and record audit log', async () => {
      const newUserId = 'new-user-123';
      const mockCollectionWithSave = createMockCollection(false, true);
      mockCollectionWithSave.save = jest.fn().mockResolvedValue({
        ...mockCollectionWithSave,
        collaborators: [...mockCollectionWithSave.collaborators, { userId: newUserId, role: CollectionRole.Viewer }],
      });
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockCollectionWithSave) });

      const result = await service.addCollaborator(
        mockCollectionId,
        { userId: newUserId, role: CollectionRole.Viewer },
        mockCreatorId,
      );

      expect(result.collaborators).toHaveLength(3);
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AddCollaborator',
          targetUserId: newUserId,
          newRole: CollectionRole.Viewer,
        }),
      );
    });

    it('should update role if collaborator already exists', async () => {
      const mockCollectionWithSave = createMockCollection(false, true);
      const originalCollaborators = JSON.parse(JSON.stringify(mockCollectionWithSave.collaborators));
      mockCollectionWithSave.save = jest.fn().mockImplementation(() => {
        const updated = { ...mockCollectionWithSave };
        const viewerIndex = updated.collaborators.findIndex((c: { userId: string }) => c.userId === mockViewerId);
        if (viewerIndex !== -1) {
          updated.collaborators[viewerIndex] = { ...updated.collaborators[viewerIndex], role: CollectionRole.Editor };
        }
        return Promise.resolve(updated);
      });
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockCollectionWithSave) });

      const result = await service.addCollaborator(
        mockCollectionId,
        { userId: mockViewerId, role: CollectionRole.Editor },
        mockCreatorId,
      );

      const updatedViewer = result.collaborators.find((c: { userId: string }) => c.userId === mockViewerId);
      expect(updatedViewer?.role).toBe(CollectionRole.Editor);
    });

    it('should throw ForbiddenException when viewer tries to add collaborator', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(
        service.addCollaborator(
          mockCollectionId,
          { userId: 'new-user', role: CollectionRole.Viewer },
          mockViewerId,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(auditLogService.create).not.toHaveBeenCalled();
    });
  });

  describe('removeCollaborator', () => {
    it('should allow creator to remove collaborator and record audit log', async () => {
      const mockUpdatedCollection = {
        ...mockPrivateCollection,
        collaborators: [{ userId: mockEditorId, role: CollectionRole.Editor }],
      };
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      collectionModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUpdatedCollection) });

      const result = await service.removeCollaborator(mockCollectionId, mockViewerId, mockCreatorId);

      expect(result!.collaborators).toHaveLength(1);
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RemoveCollaborator',
          targetUserId: mockViewerId,
        }),
      );
    });

    it('should throw ForbiddenException when viewer tries to remove collaborator', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(service.removeCollaborator(mockCollectionId, mockEditorId, mockViewerId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(collectionModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateCollaboratorRole', () => {
    it('should allow creator to update role and record audit log with old and new role', async () => {
      const mockCollectionWithSave = createMockCollection(false, true);
      mockCollectionWithSave.save = jest.fn().mockResolvedValue({
        ...mockCollectionWithSave,
        collaborators: [
          { userId: mockEditorId, role: CollectionRole.Editor },
          { userId: mockViewerId, role: CollectionRole.Editor },
        ],
      });
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockCollectionWithSave) });

      const result = await service.updateCollaboratorRole(
        mockCollectionId,
        mockViewerId,
        { role: CollectionRole.Editor },
        mockCreatorId,
      );

      const updatedViewer = result.collaborators.find((c: { userId: string }) => c.userId === mockViewerId);
      expect(updatedViewer?.role).toBe(CollectionRole.Editor);
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UpdateCollaboratorRole',
          targetUserId: mockViewerId,
          oldRole: CollectionRole.Viewer,
          newRole: CollectionRole.Editor,
        }),
      );
    });

    it('should throw NotFoundException when target collaborator does not exist', async () => {
      collectionModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPrivateCollection) });
      await expect(
        service.updateCollaboratorRole(
          mockCollectionId,
          'non-existent-user',
          { role: CollectionRole.Editor },
          mockCreatorId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(auditLogService.create).not.toHaveBeenCalled();
    });
  });
});
