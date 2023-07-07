import { Injectable, Type } from '@nestjs/common';
import { Controller } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { RabbitToken } from './rabbit.constants';
import { IControllerMetadata, IRabbitMetadataConfiguration } from './rabbit.interfaces';

@Injectable()
export class RabbitMetadataAccessor {

  private readonly reflector: Reflector;

  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  isConsumerComponent(target: Type | Function): boolean {
    if (!target) {
      return false;
    }

    return !!this.reflector.get(RabbitToken.consumeController, target);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  getConsumerComponentMetadata(target: Type | Function): IControllerMetadata {
    return this.reflector.get(RabbitToken.consumeController, target);
  }

  // eslint-disable-next-line consistent-return
  getMethodMetadata(
    instance: object,
    instancePrototype: Controller,
    methodKey: string,
    controllerMetadata: IControllerMetadata,
  ): IRabbitMetadataConfiguration {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const targetCallback = instancePrototype[methodKey];

    const metadata = Reflect.getMetadata(RabbitToken.queueConsumer, targetCallback);

    return {
      ...metadata,
      instance,
      callback: metadata ? targetCallback.bind(instance) : null,
      queueName:
        metadata && controllerMetadata.patternPrefix
          ? `${controllerMetadata.patternPrefix}.${metadata.queueName}`
          : metadata?.queueName,
    };
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  getRMQValidation(target: Function): boolean | undefined {
    return this.reflector.get(RabbitToken.validate, target);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  getRMQTransformation(target: Function): boolean | undefined {
    return this.reflector.get(RabbitToken.transform, target);
  }

}
