import { AuditAction, CollectionRole, UserRole } from './enums';

export interface AuthUser {
  id: string;
  role: UserRole;
  canDownloadCommercial?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface CollaboratorInput {
  userId: string;
  role: CollectionRole;
}

export interface UpdateCollaboratorRoleInput {
  role: CollectionRole;
}

export interface AuditLogInput {
  action: AuditAction;
  userId: string;
  collectionId: string;
  assetId?: string;
  targetUserId?: string;
  oldRole?: string;
  newRole?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
