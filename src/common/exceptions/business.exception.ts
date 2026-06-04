import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    public readonly code?: string,
  ) {
    super({ message, code, statusCode }, statusCode);
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super({ message, statusCode: HttpStatus.NOT_FOUND }, HttpStatus.NOT_FOUND);
  }
}

export class DuplicateResourceException extends HttpException {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    super({ message, statusCode: HttpStatus.CONFLICT }, HttpStatus.CONFLICT);
  }
}

export class UnauthorizedActionException extends HttpException {
  constructor(action?: string) {
    const message = action ? `Not authorized to ${action}` : 'Not authorized';
    super({ message, statusCode: HttpStatus.FORBIDDEN }, HttpStatus.FORBIDDEN);
  }
}

export class InvalidStateException extends HttpException {
  constructor(current: string, target: string) {
    const message = `Cannot transition from ${current} to ${target}`;
    super({ message, statusCode: HttpStatus.UNPROCESSABLE_ENTITY }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
