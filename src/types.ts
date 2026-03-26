export interface Document {
  documentId: number;
  name: string;
  content: string;
  summary?: string;
}

export interface Comment {
  commentId: number;
  annotationId: number;
  answerId: number;
  content: string;
}

export interface Annotation {
  annotationId: number;
  documentId: number;
  startInt: number;
  endInt: number;
  comments: Comment[];
}

export interface DocLink {
  docdocId: number;
  documentId: number;
  linkId: number;
  startInt: number;
  endInt: number;
  startlink: number;
  endlink: number;
  linkName?: string;
}
