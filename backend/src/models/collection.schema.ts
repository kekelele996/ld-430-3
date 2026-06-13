import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CollectionRole } from '../types/enums';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ _id: false })
export class Collaborator {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true, enum: CollectionRole, default: CollectionRole.Viewer })
  role!: CollectionRole;
}

@Schema({ timestamps: true })
export class Collection {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  creatorId!: string;

  @Prop()
  coverUrl?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Asset', default: [] })
  assetIds!: Types.ObjectId[];

  @Prop({ default: false })
  isPublic!: boolean;

  @Prop({ type: [Collaborator], default: [] })
  collaborators!: Collaborator[];
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);
