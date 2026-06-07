import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ChatMessage } from '../utils/projectStorage';

export interface ParsedOperation {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  servers: string[];
}

export interface ParsedParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required: boolean;
  description?: string;
  schema?: { type?: string; example?: string; enum?: string[] };
  example?: string;
  enum?: string[];
}

export interface ParsedSpec {
  title: string;
  version: string;
  description?: string;
  servers: string[];
  operations: ParsedOperation[];
}

export interface CollectorParam {
  name: string;
  value: string;
  enum?: string[];
}

export interface CollectorConfig {
  id: string;
  description: string;
  collectUrl: string;
  collectMethod: 'get' | 'post' | 'post_with_body' | 'other';
  authentication: 'none' | 'basic' | 'basicSecret' | 'login' | 'loginSecret' | 'oauth' | 'oauthSecret';
  username?: string;
  password?: string;
  requestHeaders: CollectorParam[];
  requestParams: CollectorParam[];
  paginationType: 'none' | 'response_body' | 'response_header' | 'response_header_link' | 'request_offset' | 'request_page';
  paginationMaxPages: number;
  paginationAttribute: string;
  paginationNextRelation: string;
  paginationOffsetField: string;
  paginationLimitField: string;
  paginationLimit: number;
  paginationPageField: string;
  paginationSizeField: string;
  paginationSize: number;
  paginationZeroIndexed: boolean;
  timeout: number;
  rejectUnauthorized: boolean;
  disableTimeFilter: boolean;
  sendToRoutes: boolean;
  pipeline?: string;
  output?: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  cronSchedule: string;
  tz: string;
  timeRangeType: 'relative' | 'absolute';
  earliest: number;
  latest: number;
  logLevel: 'info' | 'debug' | 'error';
}

export interface WizardState {
  rawSpec: string;
  parsedSpec: ParsedSpec | null;
  selectedOperation: ParsedOperation | null;
  collectorConfig: CollectorConfig;
  scheduleConfig: ScheduleConfig;
  currentProjectId: string | null;
  chatMessages: ChatMessage[];
  chatDraft: string;
  preserveConfig: boolean;
}

interface WizardContextValue extends WizardState {
  setRawSpec: (s: string) => void;
  setParsedSpec: (s: ParsedSpec | null) => void;
  setSelectedOperation: (op: ParsedOperation | null) => void;
  setCollectorConfig: (cfg: CollectorConfig) => void;
  setScheduleConfig: (cfg: ScheduleConfig) => void;
  setCurrentProjectId: (id: string | null) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  setChatDraft: (draft: string) => void;
  setPreserveConfig: (v: boolean) => void;
  reset: () => void;
}

const defaultCollectorConfig: CollectorConfig = {
  id: 'my-rest-collector',
  description: '',
  collectUrl: '',
  collectMethod: 'get',
  authentication: 'none',
  requestHeaders: [],
  requestParams: [],
  paginationType: 'none',
  paginationMaxPages: 100,
  paginationAttribute: '',
  paginationNextRelation: 'next',
  paginationOffsetField: '',
  paginationLimitField: '',
  paginationLimit: 100,
  paginationPageField: '',
  paginationSizeField: '',
  paginationSize: 100,
  paginationZeroIndexed: false,
  timeout: 30,
  rejectUnauthorized: true,
  disableTimeFilter: false,
  sendToRoutes: true,
};

const defaultScheduleConfig: ScheduleConfig = {
  enabled: true,
  cronSchedule: '0 */4 * * *',
  tz: 'UTC',
  timeRangeType: 'relative',
  earliest: -14400,
  latest: 0,
  logLevel: 'info',
};

const initialState: WizardState = {
  rawSpec: '',
  parsedSpec: null,
  selectedOperation: null,
  collectorConfig: defaultCollectorConfig,
  scheduleConfig: defaultScheduleConfig,
  currentProjectId: null,
  chatMessages: [],
  chatDraft: '',
  preserveConfig: false,
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState);

  const setRawSpec = (rawSpec: string) => setState(s => ({ ...s, rawSpec }));
  const setParsedSpec = (parsedSpec: ParsedSpec | null) => setState(s => ({ ...s, parsedSpec }));
  const setSelectedOperation = (selectedOperation: ParsedOperation | null) =>
    setState(s => ({ ...s, selectedOperation }));
  const setCollectorConfig = (collectorConfig: CollectorConfig) =>
    setState(s => ({ ...s, collectorConfig }));
  const setScheduleConfig = (scheduleConfig: ScheduleConfig) =>
    setState(s => ({ ...s, scheduleConfig }));
  const setCurrentProjectId = (currentProjectId: string | null) =>
    setState(s => ({ ...s, currentProjectId }));
  const setChatMessages = (chatMessages: ChatMessage[]) =>
    setState(s => ({ ...s, chatMessages }));
  const setChatDraft = (chatDraft: string) =>
    setState(s => ({ ...s, chatDraft }));
  const setPreserveConfig = (preserveConfig: boolean) =>
    setState(s => ({ ...s, preserveConfig }));
  const reset = () => setState(initialState);

  return (
    <WizardContext.Provider
      value={{ ...state, setRawSpec, setParsedSpec, setSelectedOperation, setCollectorConfig, setScheduleConfig, setCurrentProjectId, setChatMessages, setChatDraft, setPreserveConfig, reset }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}
