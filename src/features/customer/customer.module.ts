import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

@Module({
  imports: [ConfigModule],
  controllers: [CustomerController],
  providers: [CustomerService, SupabaseService, SupabaseAuthGuard],
  exports: [CustomerService],
})
export class CustomerModule {}
