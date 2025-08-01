import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { CustomerService } from '../../features/customer/customer.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly customerService: CustomerService,
  ) {}

  // Service: Registers a new user without forcing an automatic login.
  async registerUser(email: string, password: string, username: string, phone: string, company: string, title: string): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    if (data && data.user) {
      await this.customerService.createCustomer(data.user.id, email, username, phone, company, title);
      // Do not force a login attempt; return tokens only if provided in the sign-up response.
      return {
        message: 'User registered successfully',
        access_token: data.session?.access_token || null,
        refresh_token: data.session?.refresh_token || null,
        user: data.user,
      };
    }
    return { message: 'User registration failed', user: null };
  }

  // Service: Refreshes the access token using the provided refresh token.
  async refreshAccessToken(refreshToken: string): Promise<any> {
    const supabase = this.supabaseService.getClient();
    // Assuming Supabase client provides a refreshSession method accepting a refresh token.
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    };
  }
}
