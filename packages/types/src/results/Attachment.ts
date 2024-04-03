import { AttachmentSubTypeEnum } from './AttachmentSubTypeEnum';
import { AttachmentTypeEnum } from './AttachmentTypeEnum';

export interface Attachment {
    id: string;
    fileName: string;
    filePath?: string;
    displayName?: string;
    mimeType?: string;
    description?: string;
    type: AttachmentTypeEnum;
    subType?: AttachmentSubTypeEnum;
}
