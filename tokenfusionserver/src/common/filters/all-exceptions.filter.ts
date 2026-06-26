import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCodes } from '../constants/error-codes';

/**
 * 全局异常过滤器：
 * 捕获所有异常并统一返回 { code, message, data: null }。
 * - HttpException：按 status 映射为对应业务错误码
 * - 其他异常：返回 code=500
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ErrorCodes.INTERNAL_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const resObj = res as Record<string, any>;
        message = Array.isArray(resObj.message)
          ? resObj.message.join(', ')
          : (resObj.message as string) ?? exception.message;
      }

      code = this.mapStatusToCode(status);
    } else {
      this.logger.error(
        `Unhandled exception: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    this.logger.error(
      `${request.method} ${request.url} -> ${status} [code: ${code}] ${message}`,
    );

    response.status(status).json({
      code,
      message,
      data: null,
    });
  }

  private mapStatusToCode(status: number): number {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.PARAM_INVALID;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCodes.INTERNAL_ERROR;
      default:
        return status;
    }
  }
}
