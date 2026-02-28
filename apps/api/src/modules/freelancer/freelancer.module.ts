import { Module, forwardRef } from '@nestjs/common';
import { FreelancerController } from './freelancer.controller';
import { FreelancerService } from './freelancer.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    forwardRef(() => BalanceModule),
  ],
  controllers: [FreelancerController],
  providers: [FreelancerService],
  exports: [FreelancerService],
})
export class FreelancerModule {}
