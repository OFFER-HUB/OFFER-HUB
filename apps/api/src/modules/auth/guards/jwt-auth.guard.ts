import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {
    this.logger.debug(`JwtAuthGuard initialized with JwtService: ${!!this.jwtService}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {

    // Check if endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No token provided in Authorization header');
      throw new UnauthorizedException('No token provided');
    }

    this.logger.debug(`Token received: ${token.substring(0, 20)}...`);

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.OFFERHUB_JWT_SECRET || 'fallback-secret-for-dev',
      });

      this.logger.debug(`Token payload: ${JSON.stringify(payload)}`);

      // Attach user info to request object
      (request as any).user = {
        userId: payload.sub || payload.userId,
        email: payload.email,
        type: payload.type,
      };

      this.logger.log(`User authenticated: ${payload.sub || payload.userId}`);
    } catch (error) {
      this.logger.error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
