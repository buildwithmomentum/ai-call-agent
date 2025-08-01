import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';

@Module({
  imports: [ConfigModule],
  controllers: [BusinessController],
  providers: [BusinessService, SupabaseService],
  exports: [BusinessService],
})
export class BusinessModule {}
