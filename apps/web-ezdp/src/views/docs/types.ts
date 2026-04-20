export interface FieldDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enumValues?: string[];
  nested?: MessageSchema;
}

export interface MessageSchema {
  name: string;
  description: string;
  fields: FieldDefinition[];
  example: string;
}

export interface EventData {
  eventName: string;
  direction: 'client-to-server' | 'server-to-client';
  pairedEvent?: string;
  description: string;
  request?: MessageSchema;
  response?: MessageSchema;
}

export interface DocItem {
  id: string;
  title: string;
  description?: string;
  fileName?: string;
  children?: DocItem[];
  isCategory?: boolean;
  apiType?: 'event' | 'markdown';
  eventData?: EventData;
}

export interface DocPageState {
  selectedDoc: string | null;
  content: string;
  loading: boolean;
  error: string | null;
}
