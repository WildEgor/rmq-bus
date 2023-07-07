import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { RabbitMetadataAccessor } from './rabbit.accessor';
import { IRabbitMetadataConfiguration } from './rabbit.interfaces';

@Injectable()
export class RabbitExplorer {

  private readonly metadataScanner: MetadataScanner;
  private readonly discoveryService: DiscoveryService;
  private readonly metadataAccessor: RabbitMetadataAccessor;

  constructor(
    metadataScanner: MetadataScanner,
    discoveryService: DiscoveryService,
    metadataAccessor: RabbitMetadataAccessor,
  ) {
    this.metadataScanner = metadataScanner;
    this.discoveryService = discoveryService;
    this.metadataAccessor = metadataAccessor;
  }

  explore(): IRabbitMetadataConfiguration[] {
    const controllers: InstanceWrapper[] = this.discoveryService
      .getControllers()
      .filter((wrapper: InstanceWrapper) => this.metadataAccessor.isConsumerComponent(wrapper.metatype));

    if (!controllers) {
      return [];
    }

    return controllers
      .map((wrapper: InstanceWrapper) => {
        const { instance, metatype } = wrapper;

        const { instancePrototype, controllerMetadata } = {
          instancePrototype: Object.getPrototypeOf(instance),
          controllerMetadata: this.metadataAccessor.getConsumerComponentMetadata(metatype),
        };

        return this.metadataScanner.scanFromPrototype(instance, instancePrototype, (method) => this.metadataAccessor.getMethodMetadata(
          instance,
          instancePrototype,
          method,
          controllerMetadata,
        ));
      })
      .reduce((prev, curr) => prev.concat(curr), [])
      .filter((handler) => handler.callback);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  transformRequest(instance: object, method: Function, funcArgs: any[]): any[] {
    const transformMsg = this.metadataAccessor.getRMQTransformation(method);
    console.log(method);
    if (!transformMsg) {
      console.log('OOOPS');
      return funcArgs;
    }
    console.log('trasnform');
    const types = Reflect.getMetadata('design:paramtypes', Object.getPrototypeOf(instance), method.name);
    funcArgs[0] = plainToClass(types[0], funcArgs[0]);
    return funcArgs;
  }

  async validateRequest(
    // eslint-disable-next-line @typescript-eslint/ban-types
    instance: Record<string, Function>,
    // eslint-disable-next-line @typescript-eslint/ban-types
    methodRef: Function,
    funcArgs: any[],
  ): Promise<string | undefined> {
    const validateMsg = this.metadataAccessor.getRMQValidation(methodRef);

    if (!validateMsg) {
      return;
    }

    const types = Reflect.getMetadata('design:paramtypes', Object.getPrototypeOf(instance), methodRef.name);
    const classData = funcArgs[0];
    const test = Object.assign(new types[0](), classData);
    const errors = await validate(test);

    if (!errors?.length) {
      return;
    }

    const message = errors
      .map((m) => Object.values(m.constraints!).join('; '))
      .join('; ');

    // eslint-disable-next-line consistent-return
    return message;
  }

}
