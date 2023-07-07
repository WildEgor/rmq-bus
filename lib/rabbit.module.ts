import {
  DynamicModule,
  FactoryProvider,
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryModule, ModuleRef } from '@nestjs/core';
import { Channel, Connection, ConnectionOptions, Publisher } from 'rabbitmq-client';
import { RabbitMetadataAccessor } from './rabbit.accessor';
import { getHandlerForLegacyBehavior } from './rabbit.behavior';
import { Errors, RabbitToken } from './rabbit.constants';
import { RabbitExplorer } from './rabbit.explorer';
import {
  IPublishAsyncOptions,
  IPublisherOptions,
  IPublishOptionsFactory,
  IRabbitAsyncOptions,
  IRabbitModuleOptions,
  IRabbitOptionsFactory,
} from './rabbit.interfaces';
import { Nack } from './rabbit.nack';
import { RabbitPayload } from './rabbit.payload';
import { getRabbitChannelToken, getRabbitConnectionToken, getRabbitPublisherToken } from './rabbit.utils';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [RabbitExplorer, RabbitMetadataAccessor],
})
export class RabbitModule implements OnModuleInit, OnApplicationShutdown {

  private readonly logger: Logger;
  private readonly explorer: RabbitExplorer;
  private readonly moduleOptions: IRabbitModuleOptions;
  private readonly moduleRef: ModuleRef;

  constructor(
  @Inject(RabbitToken.moduleOptions)
    moduleOptions: IRabbitModuleOptions,
    moduleRef: ModuleRef,
    explorer: RabbitExplorer,
  ) {
    this.explorer = explorer;
    this.moduleRef = moduleRef;
    this.moduleOptions = moduleOptions;
    this.logger = new Logger(RabbitModule.name);
  }

  async onModuleInit(): Promise<void> {
    const { consumers, exchanges, channel } = {
      consumers: this.explorer.explore(),
      exchanges: this.moduleOptions?.exchanges || [],
      channel: this.moduleRef.get<Channel>(getRabbitChannelToken(this.moduleOptions.name)),
    };

    // TODO: impl wait logic here

    // declare exchanges
    for (const exchange of exchanges) {
      if (exchange?.createIfNotExists) {
        await channel.exchangeDeclare({
          exchange: exchange.name,
          type: exchange.type,
          durable: exchange?.durable,
        });
        this.logger.log(`Mapped exchange ${exchange.name} | ${exchange.type}`);
      }
    }

    for (const consumer of consumers) {
      let queueName = consumer?.queue ?? consumer?.pattern ?? '';
      const routingKey = consumer?.routingKey;
      let exchange = consumer?.exchange;

      // If service definition exists on module config AND consumer exchange is null
      // or matches service exchange
      if (this.moduleOptions.service) {
        if (!exchange || (exchange && this.moduleOptions.service.exchange === exchange)) {
          queueName = `${queueName}-${this.moduleOptions.service.name}`;
          exchange = this.moduleOptions.service.exchange;
        }
      }
      else if (!exchange) {
        const msg = `Exchange on queue handler "${consumer.methodName.toString()}" is required since AMQPModule configuration is missing the service property.`;
        this.logger.error(msg);
        throw new Error(Errors.FAILED_EXCHANGE);
      }

      // handler.assertQueue takes precedence over assertQueuesByDefault
      if (
        consumer.createQueueIfNotExists === true
      ) {
        const queue = await channel.queueDeclare({
          queue: queueName,
          durable: true,
        });
        queueName = queue.queue;

        this.logger.log(`Mapped queue ${queueName}`);

        await channel.queueBind({
          queue: queueName,
          exchange,
          routingKey,
        });

        this.logger.log(`Mapped bind ${exchange}::${queueName}`);
      }

      await channel.basicConsume({
        queue: `${queueName}`,
      }, async(msg) => {
        try {
          const payload = new RabbitPayload(msg);

          if (this.moduleOptions?.enableDebug) {
            this.logger.debug('Consumed raw message: ');
            this.logger.debug({
              queue: queueName,
              exchange: payload.exchange,
              routingKey: payload.routingKey,
              body: payload.body,
              content: payload.content,
            });
          }

          // TODO: use class-transform and class-validator
          // const args = this.explorer.transformRequest(consumer.instance, consumer.callback, [payload.content]);
          // const error = await this.explorer.validateRequest(consumer.instance, consumer.callback, payload.content);
          // if (error) {
          //   channel.basicNack({
          //     deliveryTag: msg.deliveryTag,
          //   });
          // }

          const f = await this.transformToResult(consumer.callback(payload.content));
          // if noAck, the broker won’t expect an acknowledgement of messages delivered to this consumer
          if (!consumer?.noAck && f !== false && msg) {
            channel.basicAck({
              deliveryTag: msg.deliveryTag,
            });
          }

          if (f instanceof Nack) {
            channel.basicNack({
              deliveryTag: msg.deliveryTag,
            });
          }
        }
        catch (e) {
          if (msg) {
            const errorHandler
              = consumer.errorHandler
              || getHandlerForLegacyBehavior(
                consumer.errorBehavior
                || this.moduleOptions.defaultSubscribeErrorBehavior,
              );

            await errorHandler(channel, msg, e);
          }
        }
      });

      this.logger.log(`Mapped function ${consumer.methodName.toString()} with queue ${queueName}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const connection = this.moduleRef.get<Connection>(
      getRabbitConnectionToken(this.moduleOptions.name),
    );

    this.logger.log('Closing RabbitMQ connection.');

    await connection.close();
  }

  /**
   * Метод для инициализации подключения к RabbitMQ
   * Создает экземпляр подключения и канала
   */
  public static forRootAsync(asyncOptions: IRabbitAsyncOptions): DynamicModule {
    const RabbitOptionsProvider: FactoryProvider<ConnectionOptions> = {
      provide: RabbitToken.moduleOptions,
      useFactory: async(factory: IRabbitOptionsFactory) => {
        const options = await factory.createRabbitOptions();
        return options;
      },
      inject: [asyncOptions.useExisting],
    };

    const RabbitConnectionProvider: FactoryProvider<Connection> = {
      provide: getRabbitConnectionToken(),
      useFactory: (options: IRabbitModuleOptions) => {
        const conn = new Connection(options);
        return conn;
      },
      inject: [RabbitToken.moduleOptions],
    };

    const RabbitChannelProvider: FactoryProvider<Channel> = {
      provide: getRabbitChannelToken(),
      useFactory: async(conn: Connection) => {
        const channel = await conn.acquire();
        return channel;
      },
      inject: [RabbitToken.connection],
    };

    const dynamicModule: DynamicModule = {
      module: RabbitModule,
      imports: asyncOptions.imports,
      providers: [
        RabbitOptionsProvider,
        RabbitConnectionProvider,
        RabbitChannelProvider,
      ],
      exports: [
        RabbitOptionsProvider,
        RabbitConnectionProvider,
        RabbitChannelProvider,
      ],
    };

    return dynamicModule;
  }


  /**
   * Метод для инициализации экземпляра класса для публикации сообщений
   */
  public static forPublishAsync(asyncOptions: IPublishAsyncOptions): DynamicModule {
    const RabbitChannelProvider: FactoryProvider<Channel> = {
      provide: getRabbitChannelToken(),
      useFactory: async(conn: Connection) => {
        const channel = await conn.acquire();
        return channel;
      },
      inject: [RabbitToken.connection],
    };

    const RabbitPublisherOptionsProvider: FactoryProvider<IPublisherOptions> = {
      provide: RabbitToken.pubOptions,
      useFactory: async(factory: IPublishOptionsFactory) => {
        const options = await factory.createPublishOptions();
        return options;
      },
      inject: [asyncOptions.useExisting],
    };

    const RabbitPublisherProvider: FactoryProvider<Publisher> = {
      provide: getRabbitPublisherToken(),
      useFactory: (conn: Connection, options: IPublisherOptions) => {
        const publisher = conn.createPublisher(options);
        return publisher;
      },
      inject: [RabbitToken.connection, RabbitToken.pubOptions],
    };

    const dynamicModule: DynamicModule = {
      module: RabbitModule,
      imports: asyncOptions.imports,
      providers: [
        RabbitChannelProvider,
        RabbitPublisherOptionsProvider,
        RabbitPublisherProvider,
      ],
      exports: [
        RabbitPublisherProvider,
      ],
    };

    return dynamicModule;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type,require-await
  private async transformToResult(resultOrDeferred: any) {
    if (resultOrDeferred && typeof resultOrDeferred.subscribe === 'function') {
      return resultOrDeferred.toPromise();
    }
    return resultOrDeferred;
  }

}
