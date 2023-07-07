RMQ module for NestJS

# Usage
```js
@Module({
    imports: [
        RabbitModule.forRootAsync({
            imports: [ConfigModule],
            useExisting: EventBusConfig,
        }),
        RabbitModule.forPublishAsync({
            imports: [ConfigModule],
            useExisting: EventBusConfig,
        }),
    ]
})
```

```js
@Injectable()
export class EventBusConfig implements IRabbitOptionsFactory, IPublishOptionsFactory {
    
    private readonly uri: string;
    private readonly name: string;
    private readonly timeout: number;

    constructor(configService: ConfigService) {
        this.uri = configService.getString('AMQP_URI');
        this.name = configService.getString('AMQP_PUBLISHER_NAME');
        this.timeout = 10000;
    }

    createRabbitOptions(): IRabbitModuleOptions {
        return {
            url: this.uri,
            enableDebug: this.enableDebug,
            connectionTimeout: this.timeout,
            connectionInitOptions: {
                timeout: 5000,
                wait: false,
            },
            exchanges: [
                {
                    name: 'test_exchange',
                    type: 'topic',
                    createIfNotExists: true,
                },
            ],
        };
    }

    createPublishOptions(): IPublisherOptions {
        return {
            name: this.name,
        };
    }

}
```

```js
@Injectable()
export class EventBus {
    constructor(
        @InjectRabbitPublisher()
        private readonly _publisher: Publisher
    ) {}

    public async publishEvent(text: string): Promise<void> {
        await this._publisher.send({
            exchange: 'test_exchange',
            routingKey: 'test.event',
        }, {
            text,
        })   
    }   
}
```