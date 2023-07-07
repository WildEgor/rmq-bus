import { ModuleMetadata, Type } from '@nestjs/common';
import { ConnectionOptions, ConsumerProps, PublisherProps } from 'rabbitmq-client';
// eslint-disable-next-line import/no-cycle
import { MessageErrorHandler } from './rabbit.behavior';

export interface IConsumerOptions extends Partial<ConsumerProps> {
  /**
   * If pattern is not defined, module will generate a random name for the queue.
   */
  pattern?: string
  routingKey?: string;
  exchange?: string
  /**
   * Assert this queue to existance. Takes precedence over assertQueuesByDefault
   * in module options.
   */
  createQueueIfNotExists?: boolean
  errorBehavior?: MessageHandlerErrorBehavior;
  errorHandler?: MessageErrorHandler;
}

export interface IRabbitMetadataConfiguration extends IConsumerOptions {
  // eslint-disable-next-line @typescript-eslint/ban-types
  instance: object;
  target: never;
  methodName: string | symbol;
  callback: (msg: any) => void;
  prefix: string;
}

export interface IControllerMetadata {
  patternPrefix: string
}

export interface IPublisherOptions extends Partial<PublisherProps> {
  name?: string;
}

export interface IRabbitModuleOptions extends Partial<ConnectionOptions> {
  name?: string
  enableDebug?: boolean;
  connectionInitOptions?: IRabbitConnectionInitOptions;
  defaultSubscribeErrorBehavior?: MessageHandlerErrorBehavior;
  exchanges?: IRabbitExchange[];
  service?: {
    name: string
    exchange: string
  }
}

export interface IRabbitOptionsFactory {
  createRabbitOptions(): Promise<IRabbitModuleOptions> | IRabbitModuleOptions;
}

export interface IRabbitAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string;
  useExisting: Type<IRabbitOptionsFactory>;
}

export interface IPublishOptionsFactory {
  createPublishOptions(): Promise<IPublisherOptions> | IPublisherOptions;
}

export interface IPublishAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string;
  useExisting: Type<IPublishOptionsFactory>;
}

interface IRabbitExchange {
  name: string
  type: 'direct' | 'topic' | 'headers' | 'fanout' | 'match',
  durable?: boolean;
  createIfNotExists?: boolean;
}

export enum DefaultExchanges {
  DIRECT = 'amq.direct',
}

export enum MessageHandlerErrorBehavior {
  ACK = 'ACK',
  NACK = 'NACK',
  REQUEUE = 'REQUEUE',
}

export interface IRabbitConnectionInitOptions {
  wait?: boolean;
  timeout?: number;
  reject?: boolean;
}
