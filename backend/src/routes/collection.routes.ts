export const COLLECTION_ROUTES = {
  root: 'collections',
  detail: ':id',
  addAsset: ':id/assets/:assetId',
  removeAsset: ':id/assets/:assetId',
  addCollaborator: ':id/collaborators',
  removeCollaborator: ':id/collaborators/:userId',
  updateCollaboratorRole: ':id/collaborators/:userId/role',
  auditLogs: ':id/audit-logs',
};
