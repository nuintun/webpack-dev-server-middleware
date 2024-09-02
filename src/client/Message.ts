/**
 * @module message
 */

import webpack from 'webpack';

export interface InvalidMessage {
  action: 'invalid';
  payload: {
    path: string;
    timestamp: number;
  };
}

export interface ProgressMessage {
  action: 'progress';
  payload: {
    value: number;
    status: string;
    message: string;
  };
}

export interface HashMessage {
  action: 'hash';
  payload: {
    hash: string;
    timestamp: number;
  };
}

export interface IssuesMessage {
  action: 'issues';
  payload: {
    timestamp: number;
    errors: webpack.StatsError[];
    warnings: webpack.StatsError[];
  };
}

export interface OkMessage {
  action: 'ok';
  payload: {
    timestamp: number;
  };
}

export type Message = InvalidMessage | ProgressMessage | HashMessage | IssuesMessage | OkMessage;
