import { HttpException, HttpStatus } from '@nestjs/common';

export class ServiceNotFoundException extends HttpException {
  constructor(serviceId: string) {
    super(
      {
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `Service with ID ${serviceId} not found`,
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
