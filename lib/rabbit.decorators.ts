import { applyDecorators, assignMetadata, Inject, PipeTransform, SetMetadata } from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import { RabbitToken } from './rabbit.constants';
import { IConsumerOptions } from './rabbit.interfaces';
import { getRabbitChannelToken, getRabbitConnectionToken, getRabbitPublisherToken } from './rabbit.utils';

export const InjectRabbitConnection = (conn?: string): ReturnType<typeof Inject> => (
  Inject(getRabbitConnectionToken(conn))
);

export const InjectRabbitChannel = (conn?: string): ReturnType<typeof Inject> => (
  Inject(getRabbitChannelToken(conn))
);

export const InjectRabbitPublisher = (conn?: string): ReturnType<typeof Inject> => (
  Inject(getRabbitPublisherToken(conn))
);

// eslint-disable-next-line max-len
export const RabbitSubscribe = (patternOrOptions: string | IConsumerOptions): MethodDecorator => (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
  const options: IConsumerOptions
    = typeof patternOrOptions === 'string' ? { pattern: patternOrOptions } : patternOrOptions;

  SetMetadata(RabbitToken.queueConsumer, { ...options, methodName: propertyKey })(
    target,
    propertyKey,
    descriptor,
  );
};

export const RabbitConsumer = (patternPrefix?: string): ClassDecorator =>
  // eslint-disable-next-line @typescript-eslint/ban-types,implicit-arrow-linebreak
  (target: Function) => {
    if (!patternPrefix) {
      patternPrefix = '';
    }

    const consumerMetadata = {
      patternPrefix,
    };

    SetMetadata(RabbitToken.consumeController, consumerMetadata)(target);
  };

export const createPipesRpcParamDecorator
  = (
    data?: any,
    ...pipes: (Type<PipeTransform> | PipeTransform)[]
  ): ParameterDecorator => (target, key, index) => {
    const args
    = Reflect.getMetadata(RabbitToken.payload, target.constructor, key) || {};

    const hasParamData = Object.prototype.toString.call(data) === '[object String]';
    const paramData = hasParamData ? data : undefined;
    const paramPipes = hasParamData ? pipes : [data, ...pipes];

    Reflect.defineMetadata(
      RabbitToken.payload,
      assignMetadata(args, 3, index, paramData, ...paramPipes),
      target.constructor,
      key,
    );
  };

export const RabbitPayload = (
  propertyOrPipe?: string | (Type<PipeTransform> | PipeTransform),
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator => createPipesRpcParamDecorator(
  propertyOrPipe,
  ...pipes,
);

export const RabbitTransform = (): MethodDecorator => applyDecorators(SetMetadata(RabbitToken.transform, true));
