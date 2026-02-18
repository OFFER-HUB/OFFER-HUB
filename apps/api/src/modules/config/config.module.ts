import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { BootstrapValidatorService } from './bootstrap-validator.service';

@Module({
    controllers: [ConfigController],
    providers: [BootstrapValidatorService],
})
export class ConfigModule {}
