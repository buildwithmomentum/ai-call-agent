import { Module } from '@nestjs/common';
import { FunctionsController } from './functions.controller';
import { FunctionsService } from './functions.service';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { CustomerModule } from '../customer/customer.module'; 

@Module({
  imports: [CustomerModule], 
  controllers: [FunctionsController],
  providers: [FunctionsService, SupabaseService],
  exports: [FunctionsService],
})
export class FunctionsModule {}
