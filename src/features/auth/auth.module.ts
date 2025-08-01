import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [ConfigModule, CustomerModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService],
  exports: [AuthService],
})
export class AuthModule {}
