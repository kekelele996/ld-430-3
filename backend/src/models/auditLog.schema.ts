import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuditAction } from '../types/enums';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true, enum: AuditAction })
  action!: AuditAction;

  @Prop({ required: true })
  userId!: string;

  @Prop({ type: Types.ObjectId, ref: 'Collection', required: true })
  collectionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Asset' })
  assetId?: Types.ObjectId;

  @Prop()
  targetUserId?: string;

  @Prop()
  oldRole?: string;

  @Prop()
  newRole?: string;

  @Prop({ type: Object })
  details?: Record<string, unknown>;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ collectionId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
